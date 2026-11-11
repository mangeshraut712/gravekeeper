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

- These are lab numbers from one machine against localhost with simulated throttling. There is no network latency, no CDN and no real device, so they are not a prediction of the deployed Vercel site. The deployed site was not tested.
- `/lantern-hill` builds its receipts on the server per request; its numbers here do not include a cold serverless start.
- Pages were measured in their initial state. The lookup flow (a live GitHub and Archive request) and the proof workbench after a file is chosen were not measured.
- Lighthouse accessibility 100 is not a WCAG conformance claim. See `docs/A11Y_AUDIT.md`.
