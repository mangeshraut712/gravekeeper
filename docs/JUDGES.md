# Judge guide

A map from each judging criterion to evidence in this repository, plus the submission requirements with their real status. Everything here describes `main` as of merge commit `7a55157` (PRs #7 dependency autopsy, #9 proof workbench, #10 performance and share previews, #11 epitaph timeline, #13 review-finding fixes, #12 revival kit export). The revival kit was present in the production JavaScript at https://gravekeeper-drab.vercel.app when checked at 13:06:49 UTC on 2026-11-11, shortly after that merge.

Fastest path: the 60-second walkthrough at the top of [README.md](../README.md#try-it-in-60-seconds), on https://gravekeeper-drab.vercel.app.

## Submission requirements

Checked on 2026-11-11 (UTC).

| Requirement | Status | How it was checked |
|---|---|---|
| Public repository | Done | `gh repo view` reports `visibility: PUBLIC` for https://github.com/mangeshraut712/gravekeeper |
| Open-source license detected | Done: MIT | `gh repo view` reports `licenseInfo.key: mit`; [LICENSE](../LICENSE) |
| `/.kiro` at the repo root and not ignored | Done | `git check-ignore .kiro` matches nothing; the GitHub contents API lists `agents`, `evidence`, `hooks`, `settings`, `specs`, `steering` under `.kiro` on `main` |
| Working application URL | Done | https://gravekeeper-drab.vercel.app: `/`, `/proof`, `/restoration`, `/lantern-hill`, `/opengraph-image`, `/robots.txt` and `/sitemap.xml` returned HTTP 200 at about 12:38 UTC. A `POST /api/resurrect` for `atom/atom` returned 7 receipts with a complete timeline and a `package.json` autopsy |
| Demo video under 3 minutes on YouTube | **Pending** | Not recorded or uploaded. Scripts for a 90-second cut and a 2:30 to 2:45 cut are in [DEMO_SCRIPT.md](DEMO_SCRIPT.md). Video URL: ______ |
| Category | Resurrection | Planned in the draft [submission/DEVPOST.md](submission/DEVPOST.md). Nothing has been submitted |
| Kiro usage write-up | Draft | [submission/WRITEUP.md](submission/WRITEUP.md), [KIRO_WORKFLOW.md](KIRO_WORKFLOW.md), [KIRO_USAGE.md](../KIRO_USAGE.md) |
| Devpost submission | **Not submitted** | The owner submits; this repository never does |
| Best Student Project | Not entered | |

## Potential Impact

- **Problem and audience.** People reviving abandoned code or checking dead sites need to know what survived, how stale it is, and where to start. One lookup returns the archive snapshot, archive life span, repository health, dependency drift and a revival plan. See [README.md](../README.md) and [.kiro/steering/product.md](../.kiro/steering/product.md).
- **Concrete output on real projects.** Real local production-build lookups on 2026-11-11 are recorded in [DEPENDENCY_AUTOPSY.md](DEPENDENCY_AUTOPSY.md). `facebookarchive/flux` had 22 declared packages, of which 14 were major behind, 6 minor behind and 2 current. Its plan begins "Upgrade @babel/core ^7.12.10 → 8.x (major behind)". `atom/atom` was capped at 40 of 157 declared packages.
- **Archive life span.** For `atom/atom`, [EPITAPH_TIMELINE.md](EPITAPH_TIMELINE.md) records 136 captured months from 2014-06-22 to October 2026. It also records that `www.geocities.com` timed out twice, and the panel showed the error.
- **Shareable, checkable records.** Permalinks (`/?url=`), a downloadable proof that anyone can check offline or on `/proof`, and a **revival kit** (`REVIVAL.md` plus a tracking-issue body) generated only after the same proof check, with the proof SHA-256 in the file. See [REVIVAL_KIT.md](REVIVAL_KIT.md).
- **Limits.** Declared versions only, from a root manifest (no lockfile, transitive or vulnerability data). Anonymous GitHub limits allow roughly a dozen lookups per hour per server IP. No usage numbers exist; none are claimed.

## Technological Implementation

- **Signed receipt chain.** `src/lib/receipts/chain.ts` and `crypto.ts` use Web Crypto Ed25519 and SHA-256 with canonical JSON. The six correctness properties in [.kiro/specs/resurrect/design.md](../.kiro/specs/resurrect/design.md) are fast-check tests in `chain.test.ts` and `crypto.test.ts`.
- **Snapshot fallback (branch `feat/cdx-snapshot-fallback-20261111`, started from `0d944db`).** When the availability API misses but the signed CDX evidence has captures, the card, kit and proof show a capture from the latest captured month, labelled as coming from the capture index; `wayback-miss` and `wayback-cdx` stay as answered. Verified by mocked tests and one local build lookup where availability answered (so the fallback did not run live). Not re-checked on production. See [EPITAPH_TIMELINE.md](EPITAPH_TIMELINE.md).
- **Evidence binding.** Each receipt carries its exact normalized payload. `src/client/proof.ts` and `scripts/verify-proof.ts` share that code: they recompute digests and rebuild the displayed autopsy (`src/lib/deps/autopsy.ts`) and timeline (`src/lib/wayback/timeline.ts`). An edited value fails. The tamper runs are recorded in DEPENDENCY_AUTOPSY.md and EPITAPH_TIMELINE.md.
- **Upstream clients.** `src/lib/wayback/{client,cdx}.ts`, `src/lib/github/client.ts` and `src/lib/deps/{manifest,registry}.ts` return `Result<T>`, use 10-second timeouts, follow the visitor's cancel signal and enforce size caps. They run in parallel where independent (`src/app/api/resurrect/route.ts`).
- **Version comparison.** A dependency-free npm/PyPI floor comparator, `src/lib/deps/semver.ts`. Review findings on PR #7 (exclusive partials, `!=` prefixes, repeated PyPI requirements, prerelease tags) were each fixed with a failing test first ([KIRO_USAGE.md](../KIRO_USAGE.md)).
- **Tests and CI.** `npm test` ran 44 files and 682 tests, all passing, on this branch (including merged PRs #12 and #13) on 2026-11-11 after the typo and status follow-up. CI runs a `verify` job (tests, lint, typecheck, build) and a `browser` job (Playwright e2e and axe) in [.github/workflows/ci.yml](../.github/workflows/ci.yml).
- **Safety.** URL validation rejects credentials, query strings, ports, local and IP hosts. The public fork button opens GitHub's own page, and the operator fork API is off by default. See the privacy section of the README.

## Design

- **Graveyard theme with accessibility.** The design uses tombstone cards, a fog layer hidden under reduced motion, and an inline SVG illustration. Screenshots are in [README.md](../README.md#screenshots) and [screenshots/polish](screenshots/polish) (375 px and 1440 px).
- **Accessibility evidence.** [A11Y_AUDIT.md](A11Y_AUDIT.md): axe in Chromium, Firefox and WebKit found 0 counted violations on the scanned pages and states, plus 4 intentional findings on the deliberately broken Lantern Hill "before" fixture. Contrast over the fog was pixel-sampled (lowest 7.13:1 in the sampled frames). There is also a keyboard path with Escape to cancel, and `role="status"` regions.
- **Polish measurements.** [PERFORMANCE.md](PERFORMANCE.md) and [LIGHTHOUSE.md](LIGHTHOUSE.md): local lab Lighthouse results, a layout-shift fix (0.0554 to 0.0004 at 375 px) and visible focus on every tab stop.
- **New panels.** As of 2026-11-11 (branch `feat/a11y-and-demo-assets-20261111`), `npm run a11y` also scans a synthetic signed lookup with the Epitaph, Dependency autopsy and Revival kit panels (collapsed, then with disclosures open, proof verified and kit used) and `/proof` showing a valid and an invalid verdict: 0 counted violations in Chromium, Firefox and WebKit on a local production build. A keyboard-only e2e step covers those panels. Details and limits are in [A11Y_AUDIT.md](A11Y_AUDIT.md#results-panels-and-proof-verdicts-2026-11-11-branch-feata11y-and-demo-assets-20261111).
- **Limits.** No screen-reader pass. The new panels were scanned with synthetic data only, and contrast was not re-sampled for them. Lighthouse was run on localhost only, not on the deployed site.

## Innovation

- **Verifiable revival record.** Every upstream answer, the dependency registry results and the generated plan sit in one signed chain. A judge can confirm on `/proof` or offline that the displayed result matches what was signed. The tool states what that does not prove: authorship, or that the upstream actually said it.
- **Archive life span plus dependency drift** in one lookup, both rebuilt by the verifier rather than trusted from the display.
- **Actionable export.** A verified lookup can download `REVIVAL.md` and copy a tracking issue whose checkboxes match the plan, tied to the proof hash. The kit is refused when verification fails.
- **Two worked restorations.** `/restoration`: the MIT `esrever` reverser passes 4 of 12 Unicode fixtures and an original `Intl.Segmenter` rewrite passes 12 of 12. Check it with `npm run demo:verify`, or offline with `/restoration-kit.zip`. `/lantern-hill`: a 1999-style page rewritten to semantic HTML5 with signed before/after receipts.

## Presentation

- [README.md](../README.md): pitch, 60-second path, feature table with limits, Mermaid architecture diagram, setup in three commands (clone, `npm ci`, `npm run dev`).
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md): timed scripts. No video yet.
- Share previews: 1200×630 Open Graph and Twitter images; `/opengraph-image` returned `image/png` on production.
- **How Kiro built it.** Specs for [resurrect](../.kiro/specs/resurrect), [dependency-autopsy](../.kiro/specs/dependency-autopsy), [epitaph-timeline](../.kiro/specs/epitaph-timeline) and [revival-kit](../.kiro/specs/revival-kit) were committed before their code (`863f8c1`, `e8b6285`, `d44a06d`, `f52061d`). [proof-workbench](../.kiro/specs/proof-workbench) landed in the same commit as its code. The other records are [KIRO_WORKFLOW.md](KIRO_WORKFLOW.md) (observed versus configured, per file), [KIRO_USAGE.md](../KIRO_USAGE.md) (session log separating Kiro work from hand work) and [.kiro/evidence](../.kiro/evidence) (metadata-only records).

## What is not done

- Demo video, blog post and social post: not made. Their URLs are blank in the drafts.
- Screen-reader pass; contrast re-sampling of the Epitaph, autopsy and kit panels; an OS-level drag test on `/proof`; a scan of a real upstream failure.
- Performance measurement of the deployed site.
