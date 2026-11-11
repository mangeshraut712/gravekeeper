# Revival Kit — Implementation Tasks

Complete in order. Each task lists the requirements it covers (see `requirements.md`).

## Phase 1 — Pure generator

### Task 1 — Escaping (`src/lib/revival/markdown.ts`)
- [x] `escapeMarkdown(value, max?)`: control/bidi characters to spaces, truncation, entity and backslash escaping.
- [x] Unit tests: HTML tags, entities, links, images, code, emphasis, table pipes, mentions, issue references, math, newlines, bidi controls, truncation.
- [x] fast-check property 3 (no control characters, every special character escaped, unescape round trip).
- **Refs:** RK-05 (AC-1, AC-2)

### Task 2 — Issue body and REVIVAL.md (`src/lib/revival/markdown.ts`)
- [x] `buildIssueBody(input)`, `buildRevivalMarkdown(input)` following the layout in design.md.
- [x] Unit tests: facts table, snapshot link and "None found", unsafe snapshot URL is not linked, commits capped at 5, plan order, autopsy table and no-manifest note, timeline complete/empty/unavailable, proof reference fields, malicious description and commit message neutralized.
- [x] fast-check properties 1, 2, 4 and 5.
- **Refs:** RK-03 (AC-2–6), RK-04 (AC-1, AC-4), RK-05 (AC-1–5)

## Phase 2 — Browser wiring

### Task 3 — `prepareRevivalKit` (`src/client/kit.ts`)
- [x] Verify with `verifyProof`, hash `exportProof` bytes with `sha256hex`, build both texts; never throw.
- [x] Tests with a signed response: ok result whose SHA-256 equals the hash of `exportProof`; tampered displayed data, tampered evidence and missing spec are refused.
- **Refs:** RK-02 (AC-1–3), RK-03 (AC-5)

### Task 4 — `RevivalKitPanel` component
- [x] Two buttons, busy labels, two polite status regions, trust-limit sentence; download `REVIVAL.md`, copy issue body.
- [x] Render in `Gravekeeper.tsx` only when the result has a plan and GitHub metadata.
- [x] Static-markup tests: heading, buttons, status regions exist empty, each message.
- **Refs:** RK-01 (AC-1–3), RK-03 (AC-1), RK-04 (AC-2, AC-3), RK-06 (AC-1–3)

## Phase 3 — Verify and document

### Task 5 — e2e smoke (`scripts/e2e-smoke.mts`)
- [x] Download proof and REVIVAL.md from the mocked lookup; REVIVAL.md contains the proof file's SHA-256 and every step; Copy issue body announces and the clipboard equals the issue section of REVIVAL.md.
- [x] A tampered mocked response (display differs from signed evidence) refuses both actions with no download.
- **Refs:** RK-01, RK-02, RK-03, RK-04, RK-06

### Task 6 — Real example and docs
- [x] Production-build lookup of `https://github.com/facebookarchive/flux`; export REVIVAL.md through the UI; put the real file in `docs/REVIVAL_KIT.md` with what was run.
- [x] `KIRO_USAGE.md` entry and `.kiro/evidence/2026-11-11-revival-kit.json`.
- [x] npm test, lint, typegen + tsc, build, demo:verify, e2e.
- **Refs:** all
