# Proof Workbench — Tasks

- [x] 1. `src/app/proof/analyze.ts`: parse, classify, verify, project receipts. Tests with real signed fixtures plus tamper, bad JSON, missing fields, oversize.
- [x] 2. `src/components/ProofWorkbench.tsx`: file input, drop zone, paste, empty/error/valid/invalid states, `role="status"`.
- [x] 3. `src/app/proof/page.tsx` with metadata; static-markup test for empty state, labels and honesty copy.
- [x] 4. `SiteFooter` in `layout.tsx` linking `/proof`; test.
- [x] 5. Add `/proof` to `scripts/a11y-audit.mts` page list; run `npm run a11y`.
- [ ] 6. Screen-reader pass (still open: no VoiceOver/NVDA pass). Drop handler now tested in Chromium by `npm run e2e` with dispatched `dragover`/`drop` events carrying a `File` (valid then tampered proof). A real OS drag from Finder is still untested.
