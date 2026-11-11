# Dependency Autopsy — Requirements

## Overview

The revival plan in `.kiro/specs/resurrect` is metadata-only. This feature reads the dependency manifest at the root of a public GitHub repository's default branch, asks the public package registry for each declared package's latest version, and classifies how far behind each declaration is. The results become signed receipts in the existing chain and feed concrete steps into the revival plan.

It reads declared versions only. It does not resolve lockfiles, install packages, inspect source code, or check for vulnerabilities.

Terms:

- **Manifest**: `package.json` (npm), `requirements.txt` (PyPI) or `pyproject.toml` `[project].dependencies` (PyPI) at the repository root.
- **Declared spec**: the version string as written in the manifest (`^16.14.0`, `>=2.0,<3`).
- **Floor**: the lowest version a declared spec admits, as computed by Gravekeeper.
- **Status**: one of `current`, `minor-behind`, `major-behind`, `unknown`, `not-found`.

---

### DA-01 — Read the root manifest

**As a** developer reviving a repository,
**I want** Gravekeeper to read the repository's declared dependencies,
**so that** the revival plan names real packages instead of generic advice.

1. **[Event-driven]** WHEN a GitHub repository lookup returns public metadata, THEN the system SHALL request the root manifest from the repository's default branch through the public GitHub contents API in raw form.
2. **[Ubiquitous]** The system SHALL probe manifests in the order `package.json`, `requirements.txt`, `pyproject.toml` and use the first one found.
3. **[Optional]** WHERE `GITHUB_TOKEN` is set, the manifest request SHALL use the same optional Bearer header as the existing GitHub client; otherwise it SHALL be anonymous.
4. **[Unwanted]** IF none of the manifests exists, THEN the system SHALL record that outcome and return a lookup with no dependency rows, labelled "no manifest found".
5. **[Unwanted]** IF the manifest request times out, is rate limited, or returns a non-2xx status other than 404, THEN the system SHALL record a typed error code and keep the rest of the lookup.
6. **[Ubiquitous]** Manifest bodies larger than 512 KiB SHALL be rejected as `PARSE_ERROR`.

### DA-02 — Parse declared dependencies

1. **[Event-driven]** WHEN the manifest is `package.json`, THEN the system SHALL read string entries from `dependencies` and `devDependencies`, in that order. A name present in both SHALL appear once, from `dependencies`.
2. **[Event-driven]** WHEN the manifest is `requirements.txt`, THEN the system SHALL read one requirement per logical line (backslash continuations joined), ignore blank lines and comments, strip environment markers and extras, and normalise names per PEP 503.
3. **[Unwanted]** IF a `requirements.txt` line is an option (`-r`, `-e`, `--index-url`), a direct URL or path, or otherwise cannot be parsed, THEN the system SHALL skip it and count it in `skippedLines`.
4. **[Event-driven]** WHEN the manifest is `pyproject.toml`, THEN the system SHALL read the quoted strings of the `dependencies` array in the `[project]` table only.
5. **[Unwanted]** IF `package.json` is not valid JSON or not an object, THEN the system SHALL record `PARSE_ERROR` and return no dependency rows.
6. **[Unwanted]** IF a package name is longer than 214 characters or its spec is longer than 256 characters, THEN the system SHALL skip it and count it in `skippedLines`, so one entry cannot invalidate the lookup.
7. **[Ubiquitous]** The system SHALL keep at most 40 packages per lookup, report the total declared count, and set `truncated` when the cap applied.

### DA-03 — Look up the latest version

1. **[Event-driven]** WHEN dependencies are parsed, THEN the system SHALL request the latest version of each package from `https://registry.npmjs.org/<name>/latest` (npm) or `https://pypi.org/pypi/<name>/json` (PyPI).
2. **[Ubiquitous]** Registry requests SHALL run with at most 4 in flight, a 10-second per-request timeout, an 8-second batch deadline, and the request's cancel signal. The manifest probe (up to three requests) SHALL share one 10-second deadline, so a lookup stays within the route's 30-second limit.
3. **[Unwanted]** IF a package name fails the ecosystem's name rules, or its spec is a git, URL, file, link, workspace or alias spec, THEN the system SHALL NOT request it and SHALL mark it `skipped`.
4. **[Unwanted]** IF the registry returns 404, THEN the package SHALL be marked `not-found`.
5. **[Unwanted]** IF a registry request times out, is canceled by the batch deadline, returns another non-2xx status, or returns an unreadable body, THEN the package SHALL be marked `error` and the autopsy SHALL be labelled partial.

### DA-04 — Classify each dependency

1. **[Ubiquitous]** The system SHALL compute a floor for each declared spec using a comparator written in the repository, with no new dependency.
2. **[Ubiquitous]** The status SHALL be `not-found` when the registry returned 404; `unknown` when the spec has no floor, the lookup was skipped or failed, or the latest version cannot be parsed; `major-behind` when the floor's first release number is lower than latest's; `minor-behind` when the floor is lower than latest with the same first number; `current` otherwise.
3. **[Ubiquitous]** Each row SHALL show the package name, declared spec, latest version (or none), status and, for `unknown`, a short reason.
4. **[Ubiquitous]** The autopsy SHALL include counts for each status.

### DA-05 — Receipts and verification

1. **[Event-driven]** WHEN the manifest probe finishes, THEN the system SHALL record one receipt of `kind: "github-manifest"` whose evidence is the parsed manifest (path, ecosystem, SHA-256 of the raw bytes, packages with declared specs, counts) or a fixed error code.
2. **[Event-driven]** WHEN registry lookups finish, THEN the system SHALL record one receipt of `kind: "registry"` whose evidence lists, for every manifest package in order, the latest version and outcome.
3. **[Ubiquitous]** The browser verifier (`src/client/proof.ts`) and offline verifier (`scripts/verify-proof.ts`) SHALL recompute the displayed autopsy from the two evidence bodies and reject the proof when the displayed autopsy differs.
4. **[Unwanted]** IF a proof contains a registry receipt without a successful manifest receipt, an autopsy without a manifest receipt, or registry evidence that does not line up with the manifest packages, THEN verification SHALL fail.
5. **[Ubiquitous]** Proofs created before this feature (no manifest receipt, no autopsy) SHALL still verify.

### DA-06 — Revival plan

1. **[Event-driven]** WHEN the autopsy has `major-behind` or `minor-behind` rows, THEN the revival plan SHALL contain concrete upgrade steps naming the package, declared spec and latest major line, e.g. "Upgrade react ^16.14.0 → 19.x (major behind)".
2. **[Event-driven]** WHEN rows are `not-found` or `unknown`, THEN the plan SHALL name them in a review step.
3. **[State-driven]** WHILE no manifest was read or the manifest could not be parsed, the plan SHALL keep the existing metadata-only dependency step and say that no manifest was read.
4. **[State-driven]** WHILE the autopsy is partial, the plan SHALL say that some registry lookups failed.
5. **[Ubiquitous]** The plan SHALL keep at least three steps with orders 1..N.

### DA-07 — Interface

1. **[Event-driven]** WHEN a lookup includes an autopsy, THEN the results SHALL show a "Dependency autopsy" section with summary counts and a table of rows.
2. **[Ubiquitous]** Status SHALL be conveyed as text, not colour alone.
3. **[Ubiquitous]** The section SHALL state that it reads declared versions only and is not a vulnerability scan, and SHALL label partial, truncated and no-manifest results.
4. **[Ubiquitous]** The table SHALL be reachable and scrollable by keyboard, and the section SHALL add no motion beyond existing `motion-safe:` patterns.
