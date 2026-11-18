# Gravekeeper release checklist

## Verified locally

- The starter page has been replaced with the search/results/proof workbench.
- Operator fork authentication is fail-closed; public UI uses GitHub's native fork flow.
- Receipt evidence and displayed response data are verified against their digests.
- A read-only Kiro CLI review identified actionable bugs, which were addressed with regressions.
- On Nov 7, 2026 at commit f80bc4c (working tree clean): `npm test` (170 tests, 13 files), `npm run lint`, `tsc --noEmit`, `npm run build`, and `npm run demo:verify` all passed locally. Re-run on the final release commit.
- Safari rendered the production app and completed a real Atom lookup with archive, metadata, plan, and receipts. Unsafe URL submission was rejected.
- On Nov 10, 2026, from commit work on branch `feat/fog-overlay-and-vercel-20261110`: `npm test` (200 tests, 23 files), `npm run lint`, `tsc --noEmit`, and `npm run build` passed locally. A Hobby production deploy on team `mbr63` is live at https://gravekeeper-drab.vercel.app with no GitHub token and no fork secret. A public `POST /api/resurrect` for `https://github.com/facebookarchive/flux` returned HTTP 200 with wayback, github, spec, and 4 receipts. Re-run checks on the final release commit.

## Required before publishing

- [x] Run final tests, lint, typecheck, and production build in CI (`verify` and `browser` jobs green on `main`, Next.js 16.4.6 in PR #19).
- [x] Browser regression pass in Playwright (`npm run e2e`) covering lookup, proof download/verification, keyboard flow, and panels.
- [x] Automated WCAG 2.1 AA scan (`npm run a11y`, documented with caveats in `docs/A11Y_AUDIT.md`).
- [x] Public Hobby hosting at https://gravekeeper-drab.vercel.app, with no GitHub write token and no server fork secret. Re-verified HTTP 200 across `/`, `/proof`, `/restoration`, `/lantern-hill`, `/opengraph-image`, `/robots.txt`, `/sitemap.xml`, and `POST /api/resurrect` (7 signed receipts) on 2026-11-18. Keep judges' access free through Jan 29, 2027 at 1 PM PST.
- [x] Live application URL and real screenshots committed under `docs/screenshots/`.
- [x] Licensed restoration demo (`/restoration`, `npm run demo:verify`: 4/12 before, 12/12 after).
- [ ] Upload the recorded 2:37 captioned demo video (`demo-video-2026-11-18` release) to public YouTube and fill the YouTube URL in `docs/submission/DEVPOST.md` and `docs/JUDGES.md`.
- [x] Final English submission text drafts (`docs/submission/DEVPOST.md`, `docs/submission/WRITEUP.md`), public repository, MIT license, root `.kiro` directory (not ignored), and Kiro usage explanation (`KIRO_USAGE.md`, `docs/KIRO_WORKFLOW.md`).
- [x] Disclose incorporated pre-existing work and rights/licenses (`third_party/`, MIT `esrever` fixture).
- [ ] Review contest legal terms with the entrant and submit on Devpost before the deadline.

Deadline: Dec 4, 2026, 22:00 UTC (Dec 5, 03:30 IST).
Official references: https://kiroween.devpost.com/ ; https://kiroween.devpost.com/details/faqs ; https://kiroween.devpost.com/rules
