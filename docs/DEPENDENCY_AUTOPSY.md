# Dependency autopsy

For a public GitHub repository, Gravekeeper reads the dependency manifest at the root of the default branch, asks the public registry for each package's latest version, and reports how far behind each declaration is. The results are signed receipts in the same chain as the rest of the lookup, and they turn the revival plan's generic "audit your dependencies" step into named upgrade steps.

Spec: [`.kiro/specs/dependency-autopsy/`](../.kiro/specs/dependency-autopsy/) (requirements, design, tasks).

## What it does

1. **Manifest.** After repository metadata names the default branch, Gravekeeper requests `package.json`, then `requirements.txt`, then `pyproject.toml` from the GitHub contents API (`Accept: application/vnd.github.raw+json`) and uses the first one found. Requests are anonymous unless the optional `GITHUB_TOKEN` is set. All probes share one 10-second deadline, and manifests over 512 KiB are rejected.
2. **Parsing.**
   - `package.json`: string entries from `dependencies`, then `devDependencies`. A name in both is kept once, from `dependencies`.
   - `requirements.txt`: one PEP 508 requirement per logical line. Comments, backslash continuations, extras and environment markers are handled. Options (`-r`, `-e`, `--index-url`), direct URLs, paths and unparseable lines are skipped and counted.
   - `pyproject.toml`: only the string array `[project].dependencies`.
   - At most 40 packages are checked per lookup. The total declared count is still reported.
3. **Registry.** Gravekeeper reads `https://registry.npmjs.org/<name>/latest` or `https://pypi.org/pypi/<name>/json`, with at most 4 requests in flight, a 10-second timeout per request, an 8-second batch deadline, and the visitor's cancel signal. Git, URL, `file:`, `link:`, `workspace:` and `npm:` alias specs, and invalid names, are never sent to a registry.
4. **Classification.** A small comparator in `src/lib/deps/semver.ts` (no new dependency) computes the lowest version each spec admits (the "floor") and compares it with latest:
   - `major-behind`: the floor's first release number is lower than latest's.
   - `minor-behind`: the floor is lower than latest on the same major line.
   - `current`: the floor is at or above latest.
   - `unknown`: there is no floor (`*`, `<2`, git/path specs), the lookup failed, or latest can't be compared.
   - `not-found`: the registry returned 404.
5. **Receipts.** Each lookup adds a `github-manifest` receipt and a `registry` receipt.
   - The `github-manifest` evidence is the parsed manifest: path, ecosystem, SHA-256 of the raw bytes, packages with declared specs, and counts. When no manifest could be read, it is a fixed error code.
   - The `registry` evidence is each package's latest version and outcome.
   - The browser verifier and `node scripts/verify-proof.ts` rebuild the displayed autopsy from these two bodies with the same pure function (`src/lib/deps/autopsy.ts`). A changed status, version, count or row fails verification.
6. **Revival plan.** The plan adds up to five steps of the form "Upgrade react ^17.0.1 → 19.x (major behind)", then grouped steps for any remaining major-behind packages and for minor-behind packages, a review step for rows it couldn't compare, and a note when the 40-package cap applied. With no manifest, or one that couldn't be read, the plan keeps the old metadata-only step and says why.

## Limits

- **Declared versions only.** No lockfile, no install, no transitive dependencies. A caret range such as `^4.17.0` may already install 4.17.21; the floor is the version the manifest guarantees, not the one that gets installed.
- **Not a vulnerability scan.** No advisory data is consulted.
- **Root manifest only, three formats.** No monorepo workspaces, Poetry `[tool.poetry]` tables, `setup.py`, `Pipfile`, Gemfile, go.mod or Cargo.toml.
- **40-package cap.** Larger manifests are labelled truncated, and the plan says how many packages were not checked.
- **0.x versions.** A `0.x` minor bump is counted as minor-behind, even though semver treats it as breaking.
- **Registry trust.** Registry answers are not signed by the registry. A receipt shows what Gravekeeper received, under a fresh per-lookup key. It does not show that npm or PyPI actually said it.
- **Rate limits.** An anonymous lookup now makes 3 to 5 GitHub requests: metadata, commits and up to three manifest probes. That leaves about 12 anonymous lookups per hour per server IP.

## Example output (real run)

These two lookups ran on 2026-11-11, around 10:30 UTC, against a local production build (`npx next start -p 3200`) with `GITHUB_TOKEN` unset. Both responses passed `node scripts/verify-proof.ts`. After one status was edited, the flux proof was rejected with exit code 1.

| Repository | Manifest | Declared | Checked | Current | Minor behind | Major behind | Unknown | Not found | Time |
|---|---|---|---|---|---|---|---|---|---|
| `atom/atom` | package.json | 157 | 40 (truncated) | 10 | 3 | 5 | 22 | 0 | 3.8 s |
| `facebookarchive/flux` | package.json | 22 | 22 | 2 | 6 | 14 | 0 | 0 | 5.4 s |

The 22 unknown rows in `atom/atom` are bundled packages declared as `file:packages/...` (11) and pinned git URLs (11). Neither kind has a registry version to compare.

Plan steps generated for `facebookarchive/flux`:

```
Fork and clone the repository
Update the README
Upgrade @babel/core ^7.12.10 → 8.x (major behind)
Upgrade babel-loader ^8.1.0 → 10.x (major behind)
Upgrade del ^2.2.0 → 9.x (major behind)
Upgrade gulp ^4.0.2 → 5.x (major behind)
Upgrade gulp-header 1.8.2 → 2.x (major behind)
Upgrade 9 more major-behind packages
Update 6 minor-behind packages
Set up continuous integration
Triage the 6 open issues
Communicate revival intent
```

Selected `facebookarchive/flux` rows:

| Package | Declared | Latest | Status |
|---|---|---|---|
| react | ^17.0.1 | 19.3.1 | major-behind |
| webpack | ^1.11.0 | 5.112.2 | major-behind |
| immutable | ^3.7.4 | 5.1.10 | major-behind |
| fbjs | ^3.0.1 | 3.0.5 | minor-behind |
| fbemitter | ^3.0.0 | 3.0.0 | current |

Registry versions change over time, so a later run will give different counts.
