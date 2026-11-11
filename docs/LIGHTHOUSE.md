# Lighthouse

Run date: 2026-11-11 · Lighthouse 13.6.0 (pinned devDependency) · headless Chrome 157 (system Google Chrome, mobile emulation with Lighthouse's default simulated throttling) · local production build served by `next start -p 3100` on an Apple-silicon Mac. Median of 3 runs per page.

```bash
npm run build && npx next start -p 3100 &
BASE_URL=http://localhost:3100 RUNS=3 npm run lighthouse
```

## Results (after the fix below)

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 755 ms | 34 ms | 0.000 |
| `/restoration` | 100 | 100 | 100 | 100 | 755 ms | 31 ms | 0.000 |
| `/lantern-hill` | 100 | 100 | 100 | 100 | 909 ms | 47 ms | 0.000 |
| `/proof` | 100 | 100 | 100 | 100 | 754 ms | 35 ms | 0.000 |

## One real issue found and fixed

The first run scored `/lantern-hill` 94 for performance (LCP 2409 ms, CLS 0.113). The only layout shift Lighthouse listed was the new site footer: that page streams its content behind a Suspense boundary, the short "Restoring Lantern Hill…" fallback let the footer start in the viewport, and the real content then pushed it down. The fallback in `src/app/lantern-hill/page.tsx` now has `min-h-screen`, so the footer starts below the fold. After the change the page scored 100 with CLS 0.000. This shift was introduced by the footer added in this branch; no earlier Lighthouse run of the page exists to compare against.

## Caveats

- The tables above are lab numbers from one machine against localhost with simulated throttling. There is no network latency, no CDN and no real device. The deployed site is measured separately below.
- `/lantern-hill` builds its receipts on the server per request; its numbers here do not include a cold serverless start.
- Pages were measured in their initial state. The lookup flow (a live GitHub and Archive request) and the proof workbench after a file is chosen were not measured.
- Lighthouse accessibility 100 is not a WCAG conformance claim. See `docs/A11Y_AUDIT.md`.

## Production run: https://gravekeeper-drab.vercel.app

Run at 2026-11-11 14:30 UTC (the first report's `fetchTime` is 14:30:55Z) from a Mac on a home network: Lighthouse 13.6.0, headless Chrome 157 (`--headless=new --no-sandbox`, no window shown), Lighthouse's default mobile emulation with simulated throttling, median of 3 runs per page.

```bash
BASE_URL=https://gravekeeper-drab.vercel.app RUNS=3 OUT=/tmp/q9-lh npm run lighthouse
```

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 100 | 100 | 100 | 100 | 963 ms | 33 ms | 0.000 |
| `/restoration` | 100 | 100 | 100 | 100 | 830 ms | 36 ms | 0.000 |
| `/lantern-hill` | 100 | 100 | 100 | 100 | 1560 ms | 0 ms | 0.000 |
| `/proof` | 100 | 100 | 100 | **92** | 783 ms | 12 ms | 0.000 |

### One real issue found and fixed: `/proof` canonical

All three `/proof` runs scored SEO 92 with one failing audit, `canonical` ("Document does not have a valid `rel=canonical`"). The page inherited the root layout's `canonical: "/"`, so `/proof` declared the home page as its canonical URL. `src/app/proof/page.tsx` now sets `alternates: { canonical: "/proof" }`, with a test in `src/app/metadata.test.ts` that failed before the change. A local production build of the fixed code scored SEO 100 on `/proof` (one run, `--only-categories=seo` at 2026-11-11 about 14:40 UTC). **The deployed site has not been re-measured after the fix**, so the table above still shows 92 for production until this change is deployed and run again.

### Limits of the production run

- Lab data, one machine, one network, one time of day; simulated throttling. This is not a field study (no CrUX or real-user data) and there is no Lighthouse gate in CI.
- Pages were measured in their initial state only. The lookup itself (which calls the Internet Archive and GitHub) and the proof workbench after a file is chosen were not measured, so the effect of those third-party services on responsiveness is unknown.
- The script has no warm-up request, and Vercel caching and serverless start-up were not isolated. `/lantern-hill` has the highest LCP (1560 ms); it is rendered per request, but I did not investigate the number further.
- A local `npm run build` was running on the same Mac when the production run started, which may have added CPU noise to the simulated numbers. I did not repeat the run to check.
