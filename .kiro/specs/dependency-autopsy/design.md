# Dependency Autopsy — Design

Extends `.kiro/specs/resurrect/design.md`. Same `Result<T>` error model, same receipt chain (`src/lib/receipts/chain.ts`), same evidence-binding verifier. No new hashing scheme and no new dependency.

## Data flow

```
POST /api/resurrect (GitHub URL)
  ├─ Promise.all: fetchWaybackSnapshot, fetchRepoMeta           (unchanged)
  └─ if meta ok, Promise.all:
       ├─ fetchCommits                                            (unchanged)
       └─ fetchRootManifest(owner, repo, defaultBranch, signal)   lib/github/client.ts
            → parseManifest(path, text)                           lib/deps/manifest.ts
  ├─ record "github-commits"
  ├─ record "github-manifest"   evidence: ManifestEvidence | { code }
  ├─ if packages.length > 0:
  │    lookupLatestVersions(ecosystem, packages, signal)          lib/deps/registry.ts
  │    record "registry"         evidence: RegistryEvidence
  ├─ autopsy = buildAutopsy(manifestEvidence, registryEvidence)   lib/deps/autopsy.ts (pure)
  └─ spec = generateRevivalSpec(meta, commits, autopsy)
       record "spec"
```

Receipt order for a full GitHub lookup: `wayback | wayback-miss`, `github-meta`, `github-commits`, `github-manifest`, `registry` (only when packages were parsed), `spec`.

## Modules

| File | Exports | Notes |
|---|---|---|
| `src/lib/deps/semver.ts` | `parseVersion`, `compareVersions`, `rangeFloor`, `classify`, `majorOf` | Pure. No imports at runtime. Shared with the browser and offline verifier. |
| `src/lib/deps/manifest.ts` | `parsePackageJson`, `parseRequirementsTxt`, `parsePyprojectToml`, `parseManifest`, `MAX_PACKAGES` | Pure. Returns `Result<ParsedManifest>`. |
| `src/lib/deps/registry.ts` | `fetchLatestVersion`, `lookupLatestVersions`, `isValidPackageName` | Server only. Mocked fetch in tests. |
| `src/lib/deps/autopsy.ts` | `buildAutopsy` | Pure. Imported by `src/client/proof.ts` with an explicit relative `.ts` path, like `chain.ts`. |
| `src/lib/github/client.ts` | `fetchRootManifest` | Contents API, `Accept: application/vnd.github.raw+json`. |

## Types (added to `src/types/index.ts`)

```typescript
type ReceiptKind = ... | 'github-manifest' | 'registry';
type ErrorCode   = ... | 'MANIFEST_NOT_FOUND';

type Ecosystem = 'npm' | 'pypi';
type DependencyStatus = 'current' | 'minor-behind' | 'major-behind' | 'unknown' | 'not-found';

type DeclaredDependency = {
  name: string;
  spec: string;                 // exactly as declared ("" when unpinned)
  group: 'dependencies' | 'devDependencies' | 'requirements' | 'project';
};

type ManifestEvidence = {
  path: 'package.json' | 'requirements.txt' | 'pyproject.toml';
  ecosystem: Ecosystem;
  rawSha256: string;            // SHA-256 hex of the raw manifest bytes from GitHub
  totalDeclared: number;
  skippedLines: number;
  truncated: boolean;
  packages: DeclaredDependency[];   // ≤ 40
};

type RegistryOutcome = 'ok' | 'not-found' | 'error' | 'skipped';
type RegistryEvidence = {
  registry: string;             // "https://registry.npmjs.org/" or "https://pypi.org/pypi/"
  results: { name: string; latest: string | null; outcome: RegistryOutcome }[];
};

type AutopsyDependency = DeclaredDependency & {
  floor: string | null;
  latest: string | null;
  status: DependencyStatus;
  note: string | null;          // reason for unknown rows
};

type DependencyAutopsy = {
  state: 'complete' | 'partial' | 'no-manifest' | 'unavailable';
  manifest: Omit<ManifestEvidence, 'packages'> | null;
  dependencies: AutopsyDependency[];
  counts: Record<DependencyStatus, number>;
};

type ResurrectResponse = { ...; autopsy?: DependencyAutopsy | null };
```

`autopsy` is optional so proofs exported before this feature still type-check and verify. `StaleDep` is unchanged: behind rows become `reason: 'outdated'` entries in the plan's `staleDeps`, `not-found` rows become `reason: 'unknown'`.

## Version comparator

`parseVersion(s)` accepts an optional `v`, an optional PEP 440 epoch (`N!`), one or more dot-separated release numbers, then an optional pre-release:

- semver: `-` followed by dot-separated identifiers (`1.0.0-rc.1`);
- PEP 440: `a|b|rc|alpha|beta|c|pre|preview` + number, or `.dev` + number, with optional separators (`2.0rc1`, `1.0.dev3`);
- `+build` metadata and PEP 440 `.postN` / `-N` post-releases are ignored for ordering.

Returns `{ epoch, release: number[], pre: (number|string)[] | null }` or `null`.

`compareVersions(a, b)` → `-1 | 0 | 1`:
1. epoch numerically;
2. release arrays numerically, shorter array padded with zeros (`1.2` = `1.2.0`);
3. a release without `pre` ranks above one with `pre`;
4. `pre` identifiers pairwise: numbers numerically, numbers below strings, strings by code unit; a shorter prefix ranks lower. PEP 440 `dev` is mapped to sort before `a`.

`rangeFloor(spec, ecosystem)`:
- npm: returns `null` for `""`, `*`, `x`, `latest`, tags, `git…`, `http(s):`, `file:`, `link:`, `workspace:`, `npm:` aliases, `owner/repo` shorthands. Splits on `||` and returns the lowest alternative floor. In each alternative, the floor comes from the first `>=`, `>`, `=`, `^`, `~` or bare comparator; hyphen ranges use the left side; `x`/`*` parts become `0`. A range with only `<`/`<=` has no floor.
- PyPI: lower bounds from `==`, `===`, `>=`, `~=`, `>`; `==1.2.*` → `1.2`; the highest lower bound wins. `<`, `<=`, `!=` alone give no floor.

`classify(floor, latest, outcome)` implements DA-04.2. `severity` orders `current < minor-behind < major-behind`.

## Registry client

`lookupLatestVersions(ecosystem, packages, signal)` keeps the manifest order. It creates a batch signal `AbortSignal.any([signal, AbortSignal.timeout(12_000)])` and a 4-worker pool; each request adds `AbortSignal.timeout(10_000)`. Outcomes:

| Condition | outcome |
|---|---|
| invalid name or no-registry spec | `skipped` (no request) |
| 200 with string `version` (npm) / `info.version` (PyPI) | `ok` |
| 404 | `not-found` |
| timeout, abort, other status, bad JSON | `error` |

npm scoped names are requested as `@scope%2Fname`. Name rules: npm `^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$` (≤ 214 chars); PyPI `^[A-Za-z0-9]([A-Za-z0-9._-]*[A-Za-z0-9])?$`. Raw registry bodies are not kept; evidence records only `latest` and `outcome`.

## Receipts and verification

Both receipts are built with the existing `record()` helper in the route, so `contentSha256 = sha256(JSON.stringify(evidence))` like every other live receipt. Receipt URLs: `https://api.github.com/repos/<o>/<r>/contents/<path>?ref=<branch>` for a found manifest (the base `/contents` URL when none was found) and the registry base URL for the batch.

`verifyProof` additions:
- `github-manifest` requires a `github` result; evidence must be a manifest object or a failure code.
- `registry` requires a successful `github-manifest` earlier in the chain.
- If a `github-manifest` receipt exists, `buildAutopsy(manifestEvidence, registryEvidence ?? null)` must be non-null and deep-equal the displayed `autopsy`. Otherwise `autopsy` must be absent or null.
- `buildAutopsy` returns `null` when registry results do not line up with manifest packages (length or names), when packages exist but no registry evidence is present, or when evidence shapes are wrong.

Because the verifier recomputes `floor`, `status`, `note`, `counts` and `state` from signed inputs, changing any displayed autopsy field fails verification even if the evidence is untouched.

## Revival plan

`generateRevivalSpec(meta, commits, autopsy?)`:
- No autopsy, or `state` `no-manifest` / `unavailable`: existing generic dependency step, with "(metadata only)" in the title and the reason in the description.
- Otherwise the generic step is replaced by: one "Upgrade <name> <spec> → <major>.x (major behind)" step per major-behind row (first 5), one grouped step for remaining major-behind rows, one grouped minor-behind step, one review step listing not-found/unknown names. A partial autopsy adds a sentence saying some lookups failed.
- `detectedFramework` comes from declared packages when recognisable (`next`, `react`, `vue`, `@angular/core`, `svelte`, `express`, `django`, `flask`, `fastapi`), else the existing language heuristic.

## Error handling

All lib functions return `Result<T>` or per-item outcomes; none throw. The route catches nothing new: a failed manifest or registry gives a partial 200 with the receipt chain intact. A canceled request returns 499 as today, checked after the manifest/commits phase and after the registry batch.

## Correctness properties (fast-check)

1. **Antisymmetry**: `compareVersions(a, b) === -compareVersions(b, a)` for generated versions.
2. **Transitivity**: `a ≤ b ∧ b ≤ c ⇒ a ≤ c`.
3. **Reflexivity / padding**: `compareVersions(v, v) === 0`; `compareVersions("x.y", "x.y.0") === 0`.
4. **Classification monotonicity**: for fixed `latest`, `floor1 ≤ floor2 ⇒ severity(classify(floor1)) ≥ severity(classify(floor2))`.
5. **Floor soundness**: for `^v`, `~v`, `>=v`, `==v`, `rangeFloor` equals `v` up to zero padding.
6. **Parser cap**: for any generated `package.json`, `packages.length ≤ 40`, `totalDeclared` equals the deduplicated entry count, and `truncated ⇔ totalDeclared > 40`.
7. **Tamper detection**: changing any field of a generated autopsy (status, latest, declared spec, counts, state) or of either evidence body makes `verifyProof` return `false`.

## Limits

- Declared versions only. Caret/tilde ranges may already resolve to the latest minor; the floor is what the manifest guarantees, not what a lockfile installs.
- `0.x` minor bumps are counted as minor even though semver treats them as breaking.
- Only the repository root and three manifest formats. No monorepo workspaces, Poetry tables, `setup.py`, lockfiles, or vulnerability data.
- Registry answers are not signed by the registry; the receipt shows what Gravekeeper received, not source authenticity.
