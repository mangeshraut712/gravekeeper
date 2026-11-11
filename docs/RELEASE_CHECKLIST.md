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

- Run final tests, lint, typecheck, and production build against the exact release commit.
- Independent final review and a browser regression pass, including cancel/resubmit, keyboard flow, reduced motion, mobile layout, proof download, and offline verification.
- Automated WCAG 2.1 AA scan. Do not claim zero violations before this runs.
- [x] Public Hobby hosting at https://gravekeeper-drab.vercel.app, with no GitHub write token and no server fork secret. Provider abuse limits and spending-control review still need a final pass.
- Smoke-test the exact deployed version and keep judges' access free through Jan 29, 2027 at 1 PM PST.
- Live application URL: https://gravekeeper-drab.vercel.app. Real screenshots still need to be added.
- Licensed restoration demo exists (/restoration, `npm run demo:verify`); still needs a browser pass and real screenshots.
- Public YouTube demo under 3 minutes, showing the real working app on its intended device.
- Final English submission text, public repository and all assets, recognized license, root .kiro directory, and accurate Kiro usage explanation.
- Disclose any incorporated pre-existing work and rights/licenses.
- Review contest legal terms with the entrant and obtain the required approval before accepting them or submitting.

Deadline: Dec 4, 2026, 22:00 UTC (Dec 5, 03:30 IST).
Official references: https://kiroween.devpost.com/ ; https://kiroween.devpost.com/details/faqs ; https://kiroween.devpost.com/rules
