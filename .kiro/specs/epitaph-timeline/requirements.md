# Epitaph Timeline — Requirements

## Overview

A lookup today shows one Wayback snapshot: the closest capture. This feature adds the resource's life span on the Internet Archive: when it was first captured, the latest month it was captured, and how many months per year have at least one capture. The data comes from the public Internet Archive CDX API, is recorded as a signed receipt with exact evidence, and is shown as an accessible "Epitaph" timeline in the results.

It also makes results shareable: a results page can be opened from `?url=<encoded>` and offers a "Copy link" button.

A valid proof shows that the displayed timeline matches what Gravekeeper received and signed. It does not show that the Internet Archive's index is complete or correct.

Terms:

- **CDX query**: `https://web.archive.org/cdx/search/cdx?url=<url>&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=1200`.
- **Captured month**: a calendar month (UTC) with at least one capture. `collapse=timestamp:6` returns one row per captured month: the first capture in that month.
- **First capture**: timestamp of the first row.
- **Last seen**: the latest captured month. Its row is the first capture in that month, so later captures in the same month are not visible.
- **Permalink**: the home page URL with a single `url` query parameter.

---

### ET-01 — Query the CDX API

1. **[Event-driven]** WHEN a lookup runs for any accepted URL, THEN the system SHALL send the CDX query for that URL, in parallel with the existing Wayback availability and GitHub metadata requests.
2. **[Ubiquitous]** The CDX request SHALL use a 10-second timeout combined with the lookup's cancel signal.
3. **[Ubiquitous]** The system SHALL request at most 1200 rows (100 years of months).
4. **[Unwanted]** IF the CDX request times out or fails at the network level, THEN the system SHALL record `NETWORK_TIMEOUT` and keep the rest of the lookup.
5. **[Unwanted]** IF the CDX API returns a non-2xx status, THEN the system SHALL record `HTTP_ERROR` and keep the rest of the lookup.
6. **[Unwanted]** IF the body is not JSON, is larger than 512 KiB, has a header row other than `["timestamp","statuscode"]`, or has a row whose timestamp is not 14 digits or is out of order, THEN the system SHALL record `PARSE_ERROR` and keep the rest of the lookup.
7. **[Event-driven]** WHEN the CDX API returns `[]`, THEN the system SHALL treat it as a successful lookup with no captures.

### ET-02 — Aggregate the life span

1. **[Ubiquitous]** The system SHALL derive, from the captured-month timestamps only: first capture, last seen, total captured months, the year span (first year to last year, inclusive), the number of years with captures, and captured months per year for every year in the span (zero for gap years).
2. **[Ubiquitous]** Years SHALL be sorted ascending and contiguous; per-year counts SHALL sum to the total.
3. **[Unwanted]** IF the row count reaches the 1200-row limit, THEN the timeline SHALL be labelled truncated, and the UI SHALL say later captures may be missing.

### ET-03 — Signed receipt and evidence

1. **[Event-driven]** WHEN the CDX lookup finishes (success or failure), THEN the system SHALL record a receipt of `kind: "wayback-cdx"` whose `url` is the CDX query URL and whose evidence is either `{ limit, timestamps }` or `{ code }`.
2. **[Ubiquitous]** The response SHALL include `timeline`, derived from that evidence by the same pure function the verifiers use.
3. **[Unwanted]** IF the displayed `timeline` differs from what the signed evidence derives, or the CDX receipt `url` is not the CDX query for the proof's resource, THEN browser and offline verification SHALL fail.
4. **[Unwanted]** IF a proof has no `wayback-cdx` receipt but shows a timeline, THEN verification SHALL fail. Proofs made before this feature (no receipt, no timeline) SHALL still verify.
5. **[Ubiquitous]** UI and docs SHALL state that verification shows internal consistency of Gravekeeper's receipts, not that the Archive's index is true or complete.

### ET-04 — Epitaph timeline UI

1. **[Event-driven]** WHEN a lookup result has a timeline with captures, THEN the results SHALL show an "Epitaph" section with born (first capture date), last seen (month and year), years on record, and a per-year bar chart.
2. **[Ubiquitous]** The bar chart SHALL be decorative-plus-summary: a text summary for screen readers and a native, keyboard-operable table of every year and its captured-month count. Values SHALL never be conveyed by colour alone.
3. **[Ubiquitous]** The chart SHALL not animate when `prefers-reduced-motion: reduce` is set (no animation is used at all).
4. **[State-driven]** WHILE a lookup is running, the results area SHALL show an Epitaph loading state.
5. **[Unwanted]** IF the CDX API returned no captures, THEN the section SHALL say no captures were found and draw no chart.
6. **[Unwanted]** IF the CDX lookup failed, THEN the section SHALL say the life span could not be read and name the error in words.
7. **[Unwanted]** IF a result has no timeline (older proof format), THEN the section SHALL say the result has no life-span data.
8. **[Ubiquitous]** Styling SHALL follow `src/components/styles.ts` and the existing panels. Text SHALL use `text-stone-400` or lighter on dark panels.

### ET-05 — Shareable permalinks

1. **[Event-driven]** WHEN the home page loads with `?url=<encoded>` and the value passes `normalizePublicUrl`, THEN the system SHALL fill the input with the normalized URL and run the lookup once.
2. **[Unwanted]** IF the `url` parameter fails `normalizePublicUrl` (invalid, credentials, query string, local or private-looking host) or is repeated, THEN the system SHALL NOT make any request and SHALL show a status message saying the link was not looked up.
3. **[Event-driven]** WHEN a lookup succeeds, THEN the system SHALL update the address bar to the permalink with `history.replaceState`, keeping the path.
4. **[Event-driven]** WHEN the user activates "Copy link", THEN the system SHALL copy the permalink and announce "Link copied." in a polite status region; IF copying fails, THEN it SHALL announce that copying failed and show the link as text.
5. **[Ubiquitous]** A permalink SHALL contain only the normalized resource URL, never lookup results, keys or tokens.
