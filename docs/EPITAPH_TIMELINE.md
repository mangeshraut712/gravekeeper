# Epitaph timeline

Every lookup now asks the Internet Archive's public CDX index when the exact URL was captured. The results show an "Epitaph" panel: born (first capture), last seen (latest month with a capture), years on record, and a bar chart of captured months per year with a table alternative. The answer is recorded as a signed `wayback-cdx` receipt, and both the browser and the offline verifier rebuild the timeline from that receipt's evidence.

Spec: `.kiro/specs/epitaph-timeline/` (requirements, design with seven correctness properties, tasks).

## How it works

- Query: `https://web.archive.org/cdx/search/cdx?url=<normalized URL>&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=1200`. `collapse=timestamp:6` returns one row per captured month (the first capture that month). 1200 rows is 100 years of months.
- It runs in parallel with the existing Wayback availability and GitHub metadata requests, with a 10-second timeout and the lookup's cancel signal.
- Evidence is `{ limit, timestamps }` on success or `{ code }` on failure (`NETWORK_TIMEOUT`, `HTTP_ERROR`, `PARSE_ERROR`). Status codes are requested and checked for shape, then dropped.
- `buildTimeline()` in `src/lib/wayback/timeline.ts` derives the displayed timeline. It is pure and shared by the route, `verifyProof()` and `scripts/verify-proof.ts`. A proof fails if the displayed timeline differs from what the evidence derives, if the receipt URL is not the CDX query for the proof's resource, or if a timeline appears without a receipt. Proofs made before this feature (no receipt, no timeline) still verify.
- The receipt shows what Gravekeeper received and signed. It does not show that the Archive's index is complete or correct, and "last seen" has month resolution.

## Permalinks

- `/?url=<encoded>` fills the input and runs one lookup if the value passes the same `normalizePublicUrl` check as the form (public HTTP(S), no credentials, no query string, no port, no local or IP hosts). Anything else, including a repeated `url` parameter, makes no request and shows "This link's URL was not looked up…".
- After a successful lookup the address bar is replaced with the permalink (`history.replaceState`). "Copy link" copies it and announces "Link copied." in a polite status region, or shows the link as text if copying fails.
- The link contains only the resource URL.

## Real lookups (production build)

Run on 2026-11-11 against a local production build (`npx next start -p 3400`, `GITHUB_TOKEN` and `FORK_API_SECRET` unset), with `curl` to `POST /api/resurrect`. Each response was wrapped as a `gravekeeper-proof-v1` file and checked with `node scripts/verify-proof.ts`.

### https://github.com/atom/atom (11:23:25Z)

- HTTP 200 in 5.18 s. 7 receipts: `wayback, wayback-cdx, github-meta, github-commits, github-manifest, registry, spec`.
- Timeline `complete`: born 2014-06-22 19:00:15 UTC (`20140622190015`), last seen October 2026 (`20261016204610`), 136 captured months, 13 years on record, 13 with captures.
- Captured months per year: 2014: 5, 2015: 8, 2016: 7, 2017: 11, 2018: 12, 2019: 11, 2020: 12, 2021: 12, 2022: 12, 2023: 12, 2024: 12, 2025: 12, 2026: 10.
- The closest-snapshot receipt in the same lookup was `20261027223315`, later than "last seen". This is expected: last seen is the first capture in the latest captured month.
- Offline verifier: "Internally consistent: 7 receipts and their evidence verified." After adding 1 to the first year's count in the displayed timeline, it exited 1.

### http://www.geocities.com (11:23:30Z, retried 11:24:30Z)

- HTTP 200 in 10.01 s and 10.00 s. 2 receipts both times: `wayback, wayback-cdx`. The Wayback closest snapshot was `20190613084634`.
- **The CDX lookup failed both times**: timeline `unavailable`, code `NETWORK_TIMEOUT`. The 10-second limit expired before the index answered. No life-span numbers were produced by Gravekeeper for this URL.
- Offline verifier on the first response: "Internally consistent: 2 receipts and their evidence verified." After changing the displayed `code` to `HTTP_ERROR`, it exited 1.
- Context, not a Gravekeeper result: earlier the same day (about 11:12Z) a manual `curl` of the CDX API for `www.geocities.com` (no scheme, so not the same query string the app sends) with the same parameters returned 333 rows after 27.7 s. That is unsigned and was not produced by the app; it shows why the 10-second budget is too short for this host.

## Checks run

- Unit and property tests: `src/lib/wayback/timeline.test.ts`, `src/lib/wayback/cdx.test.ts`, `src/shared/permalink.test.ts`, the epitaph cases in `src/app/api/resurrect/route.test.ts` and `src/client/proof.test.ts`, and `src/components/EpitaphTimeline.test.tsx` (static markup).
- `npm run e2e` against a production build on port 3400: all 12 checks passed, including the Epitaph panel and table, the `?url=` permalink running exactly one mocked lookup, Copy link (Chromium with clipboard permission), the address bar updating after a form lookup, and a private-looking permalink making no request. The e2e lookup data is synthetic and signed locally; it is not a live lookup.
- No axe scan, contrast sampling or screen-reader pass was run for the Epitaph panel in this session. A later pass (2026-11-11) added an axe scan of the panel with synthetic data in Chromium, Firefox and WebKit (0 counted violations); see [A11Y_AUDIT.md](A11Y_AUDIT.md). Contrast sampling and a screen-reader pass are still not done.

## Limits

- Month resolution; "last seen" is the first capture in the latest captured month.
- The exact normalized URL is queried. `http`/`https`, `www`/bare host and trailing-slash variants can give different results.
- Large hosts can exceed the 10-second budget (geocities did, twice). The panel then shows the error state and the rest of the lookup is unaffected.
- The Archive does not sign its answers.
