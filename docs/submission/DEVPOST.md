# Devpost form text: DRAFT, NOT SUBMITTED

Nothing here has been submitted. Mangesh must review, fill the blanks, and submit.

## Basics

- Project name: Gravekeeper
- Category: Resurrection
- Public GitHub repository: https://github.com/mangeshraut712/gravekeeper
- Working app: https://gravekeeper-drab.vercel.app
- Video URL (YouTube, under 3 minutes): ______ (not recorded; see "Video" below)

## What it does

Gravekeeper is a digital-archaeology workbench for public websites and abandoned GitHub repositories. Enter a public URL and it looks for an Internet Archive snapshot. For GitHub repository URLs it also fetches repository metadata and recent commits, and runs a dependency autopsy: it reads the root `package.json`, `requirements.txt` or `pyproject.toml`, asks npm or PyPI for each package's latest version, and labels each declaration current, minor behind, major behind, unknown or not found. The revival plan then names concrete upgrades, such as "Upgrade react ^17.0.1 → 19.x (major behind)". Each lookup, including the manifest and registry results, is recorded as an Ed25519-signed, SHA-256 hash-chained receipt. The receipt chain can be downloaded and checked offline with `node scripts/verify-proof.ts`, which also rejects an edited autopsy. Details and a real run are in [docs/DEPENDENCY_AUTOPSY.md](../DEPENDENCY_AUTOPSY.md).

It also includes two bundled demonstrations:

- `/restoration`: a licensed restoration case. The MIT `esrever` string reverser (pinned commit, under `third_party/`) splits emoji sequences, flags and skin tones; an original `Intl.Segmenter`-based `reverse()` passes 12 of 12 fixtures where the original passes 4 of 12 (`npm run demo:verify`, `npm run demo:baseline`).
- `/lantern-hill`: an original, MIT-licensed 1999-style page rewritten into semantic HTML5, with sandboxed before/after previews and signed before/after receipts.

Limits, stated plainly:

- The revival plan uses repository metadata and the declared versions in one root manifest (40 packages at most). It is not a lockfile, transitive-dependency or vulnerability audit, and it does not repair live repositories.
- Receipts show internal consistency only. They do not prove authorship or that GitHub or the Internet Archive returned the content. Each lookup uses a fresh ephemeral key; removing a valid suffix is not detectable.
- The Internet Archive may have no snapshot for a URL; the app then returns a partial result.
- The restoration is one curated function and one curated fixture, not a general rewriting service.
- The public fork button opens GitHub's own fork page for the visitor to confirm. The operator fork API is disabled on the demo.

## Built with

Next.js 16.4.4 (App Router, Turbopack), React 19.3.0 with React Compiler, TypeScript 5, Tailwind CSS v4, Web Crypto (Ed25519, SHA-256), Vitest 5, fast-check, ESLint 9, Playwright with @axe-core/playwright for accessibility scans, GitHub REST API, Internet Archive Wayback availability API, GitHub Actions CI, Vercel (Hobby). Developed with Kiro CLI.

## How Kiro was used (short)

Kiro CLI wrote the steering docs and the spec (requirements, design, tasks) and implemented the core library tasks: receipt crypto and chain, Wayback and GitHub clients, revival spec generator, API routes, with fast-check property tests for the receipt design properties. Two custom agents are committed: `gravekeeper` (implementation) and `gravekeeper-review` (read-only reviews, which found real issues that were fixed). Some UI and safety work was done by hand and the log says so. Hooks and MCP servers are configured in `.kiro/` but their execution is not claimed; Kiro powers and Crew were not used. Details: [docs/submission/WRITEUP.md](WRITEUP.md) and [KIRO_USAGE.md](../../KIRO_USAGE.md); credit figures are in KIRO_USAGE.md and `.kiro/evidence/`. The `.kiro` directory is committed at the repo root.

## Bonus prizes (owner input needed)

- Social Blitz: draft in [SOCIAL_DRAFT.md](SOCIAL_DRAFT.md). Post URL: ______ (blank until Mangesh posts it).
- Bonus Blog: draft in [BLOG_DRAFT.md](BLOG_DRAFT.md). Published blog URL: ______ (blank until Mangesh publishes it).
- Best Student Project: Mangesh must confirm each of the following himself; nothing here is asserted. School and eligibility status: ______ ; enrollment/year: ______ ; whether the rules' student requirements are met: ______ ; any proof the rules require: ______ .
- Best Startup, Ghost of Kiroween Past, Crew: the repo does not support a claim for any of these (no startup materials, no Crew use, no Ghost-of-Kiroween-Past submission work). Not claimed. Mangesh to decide whether any applies and check the official rules.

## Video

Not recorded. A 90-second cut and a roughly 2:30 to 2:45 cut are scripted in [docs/DEMO_SCRIPT.md](../DEMO_SCRIPT.md). Recording and the YouTube upload need Mangesh.

## Things judges should know

- No login or account is needed. Use public URLs only; the submitted URL is sent to the Internet Archive and, for repository URLs, to GitHub.
- `GITHUB_TOKEN` and `FORK_API_SECRET` are unset on the demo, so GitHub lookups use anonymous rate limits (60 requests/hour) and may return a rate-limit message.
- Accessibility: axe-core scans in Chromium found no violations on the scanned product pages. The only intentional violations are on the deliberately broken Lantern Hill "before" fixture. Color contrast over the fog layer is "needs review" in axe and was checked by pixel sampling; no screen reader pass or non-Chromium scan was done. See [docs/A11Y_AUDIT.md](../A11Y_AUDIT.md).
- The results screenshot in the README is from a mocked synthetic response, labeled as such.
- Pre-existing work: `esrever` (MIT, Mathias Bynens and contributors) is included as pinned third-party source with attribution; the Lantern Hill fixture is original to this project.
