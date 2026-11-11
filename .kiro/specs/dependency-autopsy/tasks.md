# Dependency Autopsy — Implementation Tasks

Complete in order. Each task lists the requirements it covers (see `requirements.md`).

## Phase 1 — Pure library

### Task 1 — Types
- [x] Add `github-manifest` and `registry` to `ReceiptKind`, `MANIFEST_NOT_FOUND` to `ErrorCode`.
- [x] Add `Ecosystem`, `DependencyStatus`, `DeclaredDependency`, `ManifestEvidence`, `RegistryOutcome`, `RegistryEvidence`, `AutopsyDependency`, `DependencyAutopsy`; add optional `autopsy` to `ResurrectResponse`.
- **Refs:** DA-02, DA-04, DA-05

### Task 2 — Version comparator (`src/lib/deps/semver.ts`)
- [x] `parseVersion`, `compareVersions`, `majorOf` for semver and common PEP 440 forms.
- [x] `rangeFloor(spec, ecosystem)` for npm ranges and PyPI specifiers.
- [x] `classify(floor, latest, outcome)` and `severity`.
- [x] Unit tests for edge cases; fast-check properties 1–5 from design.md.
- **Refs:** DA-04

### Task 3 — Manifest parsers (`src/lib/deps/manifest.ts`)
- [x] `parsePackageJson` (dependencies then devDependencies, dedupe, cap 40).
- [x] `parseRequirementsTxt` (comments, continuations, markers, extras, options, URLs, skipped count, PEP 503 names).
- [x] `parsePyprojectToml` (`[project].dependencies` only).
- [x] `parseManifest(path, text)` dispatcher.
- [x] Unit tests for edge cases; fast-check property 6.
- **Refs:** DA-02

### Task 4 — Autopsy builder (`src/lib/deps/autopsy.ts`)
- [x] `buildAutopsy(manifestEvidence | failure, registryEvidence | null)` → `DependencyAutopsy | null`, rejecting misaligned or malformed evidence.
- [x] Unit tests for complete, partial, no-manifest, unavailable and misaligned inputs.
- **Refs:** DA-04, DA-05

## Phase 2 — IO

### Task 5 — Manifest fetch (`fetchRootManifest` in `src/lib/github/client.ts`)
- [x] Probe `package.json`, `requirements.txt`, `pyproject.toml` on the default branch via the raw contents API, with the optional token header, 10 s timeout and cancel signal.
- [x] Map 404 on all → `MANIFEST_NOT_FOUND`; rate limit → `GITHUB_RATE_LIMIT`; size cap → `PARSE_ERROR`.
- [x] Mocked-fetch tests.
- **Refs:** DA-01

### Task 6 — Registry client (`src/lib/deps/registry.ts`)
- [ ] `fetchLatestVersion` for npm and PyPI; `isValidPackageName`.
- [ ] `lookupLatestVersions` with concurrency 4, per-request timeout, batch deadline, cancel signal, `skipped` for non-registry specs.
- [ ] Mocked-fetch tests: success, 404, 500, timeout, bad JSON, concurrency limit, scoped name encoding, skipped specs.
- **Refs:** DA-03

## Phase 3 — Integration

### Task 7 — Route (`src/app/api/resurrect/route.ts`)
- [ ] Fetch the manifest in parallel with commits; record `github-manifest`; run registry lookups; record `registry`; build the autopsy; pass it to the spec generator; return `autopsy`.
- [ ] Route tests: npm manifest, requirements manifest, no manifest, registry down (partial), cancellation during registry lookup.
- **Refs:** DA-01, DA-03, DA-05

### Task 8 — Verification (`src/client/proof.ts`)
- [ ] Verify `github-manifest` / `registry` receipts and bind the displayed autopsy via `buildAutopsy`.
- [ ] Tests: valid autopsy proof, edited status/latest/counts, edited evidence, registry without manifest, autopsy without manifest, old proofs still valid, offline CLI rejects a tampered autopsy; fast-check property 7.
- **Refs:** DA-05

### Task 9 — Revival plan (`src/lib/spec/generator.ts`)
- [ ] Optional `autopsy` argument; concrete upgrade, grouped and review steps; metadata-only fallback; partial note; framework from packages.
- [ ] Unit tests and the existing properties with an autopsy argument.
- **Refs:** DA-06

## Phase 4 — Interface and docs

### Task 10 — `DependencyAutopsyPanel` (`src/components/DependencyAutopsyPanel.tsx`)
- [ ] Summary counts, table with text status badges, scope note, partial/truncated/no-manifest labels, keyboard-scrollable table region.
- [ ] Wire into `Gravekeeper.tsx` results; update the plan subtitle when dependency data was used.
- [ ] Static-markup tests.
- **Refs:** DA-07

### Task 11 — Verify and document
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm run demo:verify`.
- [ ] Real lookups of `atom/atom` and `facebookarchive/flux` against a local production build; record counts.
- [ ] `docs/DEPENDENCY_AUTOPSY.md`; `.kiro/evidence/2026-11-11-dependency-autopsy.json`.
- **Refs:** all
