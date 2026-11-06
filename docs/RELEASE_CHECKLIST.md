# Gravekeeper release checklist

## Verified locally

- The starter page has been replaced with the search/results/proof workbench.
- Operator fork authentication is fail-closed; public UI uses GitHub's native fork flow.
- Receipt evidence and displayed response data are verified against their digests.
- A read-only Kiro CLI review identified actionable bugs, which were addressed with regressions.
- On Nov 7, 2026 at commit f80bc4c (working tree clean): `npm test` (170 tests, 13 files), `npm run lint`, `tsc --noEmit`, `npm run build`, and `npm run demo:verify` all passed locally. Re-run on the final release commit.
- Safari rendered the production app and completed a real Atom lookup with archive, metadata, plan, and receipts. Unsafe URL submission was rejected.

## Required before publishing

- Run final tests, lint, typecheck, and production build against the exact release commit.
- Independent final review and a browser regression pass, including cancel/resubmit, keyboard flow, reduced motion, mobile layout, proof download, and offline verification.
- Automated WCAG 2.1 AA scan. Do not claim zero violations before this runs.
- Public free-tier hosting with no GitHub write token, no server fork secret, provider abuse limits, and no paid overages.
- Smoke-test the exact deployed version and keep judges' access free through Jan 29, 2027 at 1 PM PST.
- Add real screenshots and the verified live application URL.
- Licensed restoration demo exists (/restoration, `npm run demo:verify`); still needs a browser pass and real screenshots.
- Public YouTube demo under 3 minutes, showing the real working app on its intended device.
- Final English submission text, public repository and all assets, recognized license, root .kiro directory, and accurate Kiro usage explanation.
- Disclose any incorporated pre-existing work and rights/licenses.
- Review contest legal terms with the entrant and obtain the required approval before accepting them or submitting.

Deadline: Dec 4, 2026, 22:00 UTC (Dec 5, 03:30 IST).
Official references: https://kiroween.devpost.com/ ; https://kiroween.devpost.com/details/faqs ; https://kiroween.devpost.com/rules
