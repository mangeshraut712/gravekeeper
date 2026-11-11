# Performance and polish measurements

Measured on Nov 11, 2026 on a local production build (`npm run build` then `npx next start`), on an Apple-silicon Mac, from branch `perf/polish-and-share-20261111` (base `4184d6f`). These are local lab numbers. The Vercel deployment was not measured.

## Method

- Lighthouse 12.8.2 through `npx -y lighthouse@12`, headless Chrome for Testing 158 (Playwright's Chromium build, passed as `CHROME_PATH`), categories performance, accessibility, best-practices and SEO.
- Mobile is the Lighthouse default (simulated throttling: 150 ms RTT, about 1.6 Mbps, 4x CPU slowdown). Desktop uses `--preset=desktop`.
- `scripts/lighthouse-run.mjs` warms the server, runs each page and mode 3 times, and reports the median run. The last two columns list every run so the spread is visible.
- UI checks use `scripts/polish-check.mts` (Playwright Chromium, 375x812 and 1440x900). It mocks `/api/resurrect` with a synthetic signed response (`example/abandoned-widget`, invented data) and holds the response until a loading screenshot is taken.

Reproduce:

```bash
npm run build && npx next start -p 3417 &
CHROME_PATH=/path/to/chrome BASE_URL=http://localhost:3417 OUT_DIR=/tmp/lh RUNS=3 node scripts/lighthouse-run.mjs
BASE_URL=http://localhost:3417 node scripts/polish-check.mts --shots
```

## Lighthouse before (base `4184d6f`)

| Page | Mode | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | FCP | Perf (all runs) | TBT ms (all runs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| / | mobile | 99 | 100 | 100 | 100 | 2.1 s | 0 | 40 ms | 0.8 s | 98/99/99 | 86/38/33 |
| / | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |
| /restoration | mobile | 99 | 100 | 100 | 100 | 2.1 s | 0 | 90 ms | 0.8 s | 98/99/99 | 113/88/69 |
| /restoration | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |
| /lantern-hill | mobile | 98 | 100 | 100 | 100 | 2.2 s | 0 | 80 ms | 0.9 s | 98/98/98 | 90/76/73 |
| /lantern-hill | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |

A first single run of `/` on mobile, right after the server started, scored 69 with 2,820 ms TBT. The time was one unattributed 2.8 s main-thread task. Two immediate re-runs gave 99 (50 ms and 40 ms TBT), so I treated it as a cold-start outlier and switched to warmed 3-run medians. It is recorded here because it happened.

## Lighthouse after

| Page | Mode | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | FCP | Perf (all runs) | TBT ms (all runs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| / | mobile | 99 | 100 | 100 | 100 | 2.2 s | 0 | 30 ms | 0.8 s | 97/99/99 | 154/34/32 |
| / | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |
| /restoration | mobile | 99 | 100 | 100 | 100 | 2.1 s | 0 | 70 ms | 0.8 s | 99/99/99 | 68/67/57 |
| /restoration | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |
| /lantern-hill | mobile | 98 | 100 | 100 | 100 | 2.2 s | 0 | 80 ms | 0.9 s | 98/98/98 | 89/82/81 |
| /lantern-hill | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0 | 0 ms | 0.2 s | 100/100/100 | 0/0/0 |

The lab scores did not change beyond run-to-run spread. The baseline was already 98 to 100 everywhere, and this branch did not change the JavaScript or CSS that Lighthouse measures. Lighthouse SEO audits that were "not applicable" before now run and pass: `canonical` (no canonical link before) and `robots-txt` (no robots.txt before).

## What Lighthouse flagged, and what was done

| Finding | Decision |
|---|---|
| Mobile LCP 2.1 to 2.2 s, 78% "render delay" | The LCP element is text (the home `h1`, the `/restoration` intro paragraph). Unthrottled, Chrome observed FCP and LCP both at 124 ms. The simulated 2.1 s comes from Lighthouse modelling the page's scripts on a slow CPU. No web fonts or images are involved. Not changed. |
| Render-blocking CSS, about 7 KB, est. 60 to 150 ms | Tried `experimental.inlineCss`. Mobile LCP got worse (2.2 to 2.4 s medians) and gzipped home HTML grew from 6.2 KB to 24.3 KB, because Next inlines the CSS and also repeats it in the RSC payload. Reverted. |
| Unused JS 29 KiB, legacy JS 13 KiB | Both are in Next.js's own framework chunk (React DOM and Next's built-in polyfills such as `Array.prototype.at`, `Object.hasOwn`). Not removable from app code. Not changed. |
| Forced reflow insight | Unattributed, about 32 ms on `/restoration`, absent on most runs. Not changed. |
| Missing canonical, robots.txt, per-page descriptions | Fixed (see below). |

## UI polish measurements (`scripts/polish-check.mts`)

| Check | Before | After |
|---|---|---|
| Layout shift when results arrive, 375x812 | 0.0554 | 0.0004 |
| Layout shift when results arrive, 1440x900 | 0.0049 | 0.0006 |
| Horizontal scroll at 375 and 1440 (`/`, `/restoration`, `/lantern-hill`, `/` with results) | none | none |
| Tab stops without a visible focus indicator | 2 per viewport (both Lantern Hill preview iframes) | 0 |

Layout shift is the sum of `layout-shift` entries recorded from the moment the mocked response is released until 1.5 s after "Lookup complete". It includes shifts that Chrome's CLS would discount for recent input, so it is a stricter number than CLS.

The focus check tabs through every focusable element on each page and through the results state (12 tab stops after a lookup), and passes if the focused element has a non-`none` outline or box-shadow. It does not judge contrast or size of the indicator.

### Fixes

- **Results shift.** The loading message appeared under the form and disappeared when results arrived, and the Cancel button added a full row on mobile. The status line now reserves two lines (one from `md` up), the loading text is shorter, and Cancel sits beside the submit button instead of below it.
- **Preview iframe focus.** Chrome does not match `:focus` on an iframe while focus is inside its sandboxed document, so tabbing into the Lantern Hill previews showed no indicator (the "before" fixture has no focus styles of its own). `PreviewFrame` now draws an amber outline while focus is inside the frame. The iframes keep `sandbox=""`.

## Share previews and metadata

- `src/app/opengraph-image.tsx` and `twitter-image.tsx` render a 1200x630 PNG with `next/og` from the app's palette, tombstone mark and headline, using the default bundled font (no external images, fonts or trademarks). Both are prerendered at build time. Checked with curl on the production build: `/opengraph-image` and `/twitter-image` return `200 image/png`, and `file` reports `PNG image data, 1200 x 630`. A copy is at `docs/screenshots/polish/og-image.png`.
- Root metadata now sets `metadataBase` (`https://gravekeeper-drab.vercel.app`), a canonical URL, a title template, `summary_large_image` Twitter card, and `viewport.themeColor` `#111510` with `color-scheme: dark`. `/restoration` and `/lantern-hill` have their own title, description and canonical.
- `robots.txt` allows pages, disallows `/api/` and `/fixtures/`, and points at `sitemap.xml`, which lists the three pages.
- The rendered `<head>` was checked with curl: `og:image` and `twitter:image` point at absolute URLs with width, height, type and alt.
- Fixed after review on PR #10 (Cursor Bugbot): Next.js replaces, not merges, a child page's `openGraph` and `twitter` objects. The demo pages kept the home page's Twitter title and description and had no `og:image` or `twitter:image`. They now set their own Twitter text and list the share images explicitly. Confirmed with a failing test first (`src/app/metadata.test.ts`) and with curl on a fresh build.

Not checked: how specific social networks render the card (no link was shared anywhere).

## Screenshots

`docs/screenshots/polish/` holds viewport-only JPEGs at 375x812 and 1440x900: each page, plus the lookup loading, results and error states (results and loading use the synthetic mock; the error is a mocked 502). Total about 0.8 MB.

## Limits

- Local lab measurements only, one machine, 3 runs each. Simulated throttling, not a real phone.
- No field data (CrUX) exists for this site.
- The polish check runs in Chromium only.
