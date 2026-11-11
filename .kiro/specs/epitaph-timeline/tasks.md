# Epitaph Timeline — Implementation Tasks

Complete in order. Each task lists the requirements it covers (see `requirements.md`).

## Phase 1 — Pure library

### Task 1 — Types
- [ ] Add `wayback-cdx` to `ReceiptKind`; add `CdxEvidence`, `TimelineYear`, `EpitaphTimeline`; add optional `timeline` to `ResurrectResponse`.
- **Refs:** ET-02, ET-03

### Task 2 — Timeline module (`src/lib/wayback/timeline.ts`)
- [ ] `CDX_LIMIT`, `cdxQueryUrl`, `parseCdxBody`, `isCdxEvidence`, `buildTimeline`.
- [ ] Unit tests: empty, header-only, malformed JSON, wrong header, bad timestamp, out-of-order rows, over-limit rows, gap years, truncated, failure body.
- [ ] fast-check properties 1–5 from design.md.
- **Refs:** ET-01 (AC-6, AC-7), ET-02 (AC-1–3)

### Task 3 — CDX client (`src/lib/wayback/cdx.ts`)
- [ ] `fetchCdxCaptures(url, signal?)` with 10 s timeout, 512 KiB cap, typed errors.
- [ ] Unit tests with `vi.stubGlobal('fetch')`: success, empty, malformed, HTTP error, timeout, cancel, oversize, request URL shape.
- **Refs:** ET-01 (AC-1–6)

### Task 4 — Permalink helpers (`src/shared/permalink.ts`)
- [ ] `readPermalink`, `permalinkFor`.
- [ ] Unit tests for none, valid, invalid, private-looking, credentials, query string, repeated param; fast-check property 7.
- **Refs:** ET-05 (AC-1, AC-2, AC-5)

## Phase 2 — Route and verification

### Task 5 — Route (`src/app/api/resurrect/route.ts`)
- [ ] Run CDX in parallel with Wayback and metadata; record `wayback-cdx` after the first receipt; return `timeline`.
- [ ] Update route tests for the new receipt order; add CDX success, empty and failure cases that pass `verifyProof`.
- **Refs:** ET-01 (AC-1, AC-4, AC-5), ET-03 (AC-1, AC-2)

### Task 6 — Verification (`src/client/proof.ts`)
- [ ] Bind `wayback-cdx` receipt URL, evidence shape and derived timeline; reject a timeline without a receipt.
- [ ] Tests: valid, changed timeline field, changed evidence timestamp, wrong receipt URL, timeline without receipt, old proof without either; fast-check property 6.
- **Refs:** ET-03 (AC-3, AC-4)

## Phase 3 — UI

### Task 7 — `EpitaphTimeline` component
- [ ] Loading, missing, unavailable, empty, complete and truncated states; SVG chart `aria-hidden`; text summary; `<details>` table; trust-limit sentence.
- [ ] Static-markup tests for each state, headings, table headers, `aria-hidden`, no animation classes on the chart.
- **Refs:** ET-04 (AC-1–8), ET-03 (AC-5)

### Task 8 — Permalinks and Copy link
- [ ] `SearchForm` reads `?url=` once after mount; valid → fill and run; rejected → status message, no request.
- [ ] `Gravekeeper` replaces history after a successful lookup; renders `EpitaphTimeline` (and its loading state) and `CopyLinkButton`.
- [ ] `CopyLinkButton` with polite status region; static-markup tests.
- **Refs:** ET-05 (AC-1–5), ET-04 (AC-4)

## Phase 4 — Verify and document

### Task 9 — e2e smoke
- [ ] Add a signed `wayback-cdx` receipt and timeline to the mocked response in `scripts/e2e-smoke.mts`; check the Epitaph section.
- [ ] Permalink cases: `/?url=<repo>` runs the mocked lookup without a click and the address keeps `?url=`; Copy link announces; a private-looking `?url=` makes no request.
- **Refs:** ET-04, ET-05

### Task 10 — Real lookups and docs
- [ ] Production-build lookups of `https://github.com/atom/atom` and `http://www.geocities.com`; record actual results or failures in `docs/EPITAPH_TIMELINE.md`.
- [ ] `KIRO_USAGE.md` entry, `.kiro/evidence/2026-11-11-epitaph-timeline.json`, short mention in `docs/submission/WRITEUP.md`.
- [ ] npm test, lint, typegen + tsc, build, demo:verify, e2e.
- **Refs:** ET-03 (AC-5), all
