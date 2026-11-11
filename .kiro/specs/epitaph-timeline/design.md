# Epitaph Timeline — Design

## Data flow

```
POST /api/resurrect { url }
  ├─ fetchWaybackSnapshot(url)        (existing)
  ├─ fetchCdxCaptures(url)            new, src/lib/wayback/cdx.ts      ─┐ parallel
  └─ fetchRepoMeta(owner, repo)       (existing, GitHub URLs only)     ─┘
record wayback | wayback-miss         seq 0, url = resource
record wayback-cdx                    seq 1, url = cdxQueryUrl(resource), evidence { limit, timestamps } | { code }
record github-*, registry, spec       (existing, unchanged order)
timeline = buildTimeline(cdxEvidence) src/lib/wayback/timeline.ts (pure, isomorphic)
```

`wayback-cdx` comes right after the first receipt so that the first receipt still names the resource (`verifyProof` checks `receipts[0].url`).

## Modules

| File | Kind | Exports |
|---|---|---|
| `src/lib/wayback/timeline.ts` | pure, isomorphic (browser, Node native TS) | `CDX_LIMIT`, `cdxQueryUrl(url)`, `parseCdxBody(text)`, `isCdxEvidence(v)`, `buildTimeline(body)` |
| `src/lib/wayback/cdx.ts` | server IO | `fetchCdxCaptures(url, signal?) → Result<CdxEvidence>` |
| `src/shared/permalink.ts` | pure, browser-safe | `readPermalink(search)`, `permalinkFor(resource, location)` |
| `src/components/EpitaphTimeline.tsx` | no state, no `'use client'` | `EpitaphTimeline({ timeline, loading? })` |
| `src/components/CopyLinkButton.tsx` | `'use client'` | `CopyLinkButton({ resource })`, `CopyStatus` |

`timeline.ts` uses no `process.env`, no network and only relative imports of types, so `src/client/proof.ts` and `scripts/verify-proof.ts` can import it.

## Types (added to `src/types/index.ts`)

```ts
type ReceiptKind = … | 'wayback-cdx';

type CdxEvidence = {
  limit: number;          // always CDX_LIMIT (1200)
  timestamps: string[];   // 14-digit UTC timestamps, non-decreasing, one per captured month
};

type TimelineYear = { year: number; months: number }; // months with ≥1 capture, 0–12

type EpitaphTimeline = {
  state: 'complete' | 'truncated' | 'empty' | 'unavailable';
  code: string | null;          // error code when unavailable, else null
  firstCapture: string | null;  // 14-digit timestamp
  lastSeen: string | null;      // 14-digit timestamp of the first capture in the latest captured month
  capturedMonths: number;       // timestamps.length
  yearsOnRecord: number;        // lastYear - firstYear + 1, or 0
  yearsWithCaptures: number;
  years: TimelineYear[];        // every year from first to last, ascending
};

type ResurrectResponse = { …; timeline?: EpitaphTimeline | null };
```

`statuscode` is requested (as specified) and its shape checked (`/^(\d{3}|-)$/`), but it is not kept in evidence and does not affect the timeline. Status codes of the first capture per month say little about whether the site was alive that month.

## CDX client

- URL: `cdxQueryUrl(url)` = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=1200`.
- `AbortSignal.any([signal, AbortSignal.timeout(10_000)])`; any thrown fetch error or body read error after an abort → `NETWORK_TIMEOUT`; non-2xx → `HTTP_ERROR`.
- Body read as text; `content-length` or text length above 512 KiB → `PARSE_ERROR`.
- `parseCdxBody(text)`: `JSON.parse`; must be an array. `[]` → `{ limit, timestamps: [] }`. Otherwise row 0 must equal `["timestamp","statuscode"]`; every later row must be a 2-string array with timestamp `/^(19|20)\d{12}$/`, status `/^(\d{3}|-)$/`, and timestamps non-decreasing. More than `CDX_LIMIT` data rows → `PARSE_ERROR` (the server ignored the limit).

## Aggregation

`buildTimeline(body)`:
- `{ code }` failure body → `state: 'unavailable'`, everything else empty/zero/null.
- Not `isCdxEvidence` → `null` (verifier treats as invalid).
- `[]` → `state: 'empty'`.
- Otherwise counts per year from `timestamp.slice(0, 4)`, fills gap years with 0, `state: 'truncated'` when `timestamps.length >= limit`, else `'complete'`.

`isCdxEvidence` requires exactly the keys `limit` and `timestamps`, `limit === CDX_LIMIT`, at most `limit` timestamps, each matching the timestamp pattern, non-decreasing. Duplicate months are allowed (the verifier must not reject what the parser accepts; property 5).

## Receipts and verification

The route records `wayback-cdx` with the existing `record()` helper, so `contentSha256 = sha256(JSON.stringify(evidence))` like every other live receipt. No new hashing or signing.

`verifyProof` additions:
- `wayback-cdx`: receipt `url` must equal `cdxQueryUrl(receipts[0].url)`; evidence must be `isCdxEvidence` or `isFailureBody`.
- If a `wayback-cdx` receipt exists, `buildTimeline(evidence)` must be non-null and deep-equal `result.timeline`. Otherwise `timeline` must be absent or null (older proofs keep verifying).
- Duplicate kinds stay rejected by the existing `seen` set.

## UI

`EpitaphTimeline` renders a `<section aria-labelledby="epitaph-title">` with an `h3` "Epitaph" (results sit under the `h2` "The excavation").

- Loading: "Reading the Archive's capture index…" and a `motion-safe:animate-pulse` mark only.
- `undefined`/`null` timeline: "This result has no life-span data."
- `unavailable`: "The Internet Archive capture index could not be read (<reason in words>). The rest of the lookup is unaffected."
- `empty`: "No captures found in the Internet Archive index."
- `complete`/`truncated`: a `<dl>` with Born, Last seen, Years on record; a `<figure>` with an SVG chart (`aria-hidden`), a `<figcaption>` text summary ("Captured months per year from 1996 to 2026. Busiest year: 2009 with 12 months."), and a native `<details>` holding a `<table>` with `<caption>`, `<th scope="col">` and a row per year. Truncated adds a note. A sentence repeats the trust limit.
- Bars are amber on a stone axis; zero years show a short stone tick so a gap is visible by shape, not colour. Year labels at both ends of the axis. No animation or transition.

`CopyLinkButton` renders a button and a `role="status"` region that exists before any message. It uses `navigator.clipboard.writeText(permalinkFor(resource, location))`; on failure the status says "Could not copy. Link: <permalink>".

## Permalinks

`readPermalink(search)`:
- no `url` param → `{ kind: 'none' }`
- more than one `url` param, or `normalizePublicUrl` returns null → `{ kind: 'rejected' }`
- else `{ kind: 'lookup', url: normalized }`

`permalinkFor(resource, { origin, pathname })` → `${origin}${pathname}?url=${encodeURIComponent(resource)}`.

`SearchForm` reads `window.location.search` once after mount. `lookup` fills the input and calls the same `run()` used by submit; `rejected` sets the status message "This link's URL was not looked up: it is not a public HTTP(S) URL." and makes no request. On a successful result, `Gravekeeper` calls `history.replaceState(history.state, '', permalinkFor(...))`.

Reading `location` after mount keeps `page.tsx` a static Server Component; no `useSearchParams` Suspense boundary is needed.

## Error handling

All lib functions return `Result<T>` or a typed state; none throw. A CDX failure gives a partial 200 with a `{ code }` evidence receipt. A canceled request still returns 499 after the first parallel phase.

## Correctness properties (fast-check)

1. **Sum**: for any valid evidence, `sum(years.months) === capturedMonths === timestamps.length`.
2. **Order and span**: years are strictly ascending by 1, `years.length === yearsOnRecord`, `years[0].year` is the first timestamp's year and the last entry is the last timestamp's year.
3. **First ≤ last**: `firstCapture <= lastSeen` (string compare on 14-digit timestamps).
4. **Bounds**: `0 ≤ months ≤ capturedMonths`, `yearsWithCaptures === count(months > 0)`, `state === 'truncated' ⇔ timestamps.length >= limit`.
5. **Parser/validator agreement**: any body `parseCdxBody` accepts yields evidence for which `isCdxEvidence` holds and `buildTimeline` is non-null.
6. **Tamper detection**: changing any displayed timeline field or any evidence timestamp makes `verifyProof` return `false`.
7. **Permalink round trip**: for any URL accepted by `normalizePublicUrl`, `readPermalink(new URL(permalinkFor(u, …)).search)` returns `{ kind: 'lookup', url: u }`.

## Limits

- Month resolution only: "last seen" is the first capture in the latest captured month.
- The CDX index can lag, omit robots-excluded captures, and differ between `http`/`https` and `www`/bare host forms. Gravekeeper queries the URL exactly as normalized.
- Large hosts can take longer than 10 seconds to scan; the lookup then shows the error state.
- The Archive does not sign its answers; the receipt shows what Gravekeeper received.
