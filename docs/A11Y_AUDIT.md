# Accessibility audit (WCAG 2.1 AA)

Run date: 2026-11-11 (refreshed after the error/cancel and receipt-open scans were added) · Tool: axe-core via `@axe-core/playwright` 4.14.0 · Browser: Chromium (Playwright 1.65.0 headless shell) · Target: production build (`npm run build && next start`).

Reproduce:

```bash
npm run build && npx next start -p 3100 &   # then wait a few seconds
npx playwright install chromium            # once
BASE_URL=http://localhost:3100 npm run a11y -- --lookup
```

Rule tags scanned: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Preview iframes are excluded from the parent-page scan (sandboxed frames block the scanner) and their documents are scanned directly.

## Results

| Page / state | Violations | Rules passed | Needs manual review |
|---|---|---|---|
| `/` (initial) | 0 | 22 | 1 (color-contrast, 16 nodes) |
| `/` after a real `atom/atom` lookup, proof-section receipt details open | 0 | 27 | 1 (color-contrast, 13 nodes) |
| `/` invalid-URL error state | 0 | 22 | 1 (color-contrast, 13 nodes) |
| `/` lookup error state (mocked 404 from `/api/resurrect`) | 0 | 22 | 1 (color-contrast, 13 nodes) |
| `/` lookup running, Cancel button visible (mocked never-completing request) | 0 | 22 | 1 (color-contrast, 13 nodes) |
| `/` lookup canceled (after Escape) | 0 | 22 | 1 (color-contrast, 13 nodes) |
| `/restoration` | 0 | 23 | 0 |
| `/lantern-hill` (page, iframes excluded) | 0 | 21 | 0 |
| `/fixtures/lantern-hill/after` | 0 | 19 | 0 |
| `/fixtures/lantern-hill/before` | 4 (intentional) | 9 | 0 |

### Scan coverage for the lookup state

The `--lookup` scan opens every `<details>` inside `section[aria-labelledby="proof-title"]` (the receipt chain) and waits until the receipt body fields — Resource, Recorded at, Receipt hash, and Content digest — are visible before axe runs. It does not open the first `<details>` on the page. That first disclosure is "Detected stack" in the revival plan, which precedes the proof section, and leaving receipts collapsed would not be a receipt-details scan.

The lookup row above was re-run on 2026-11-11 against the production build after the scoping fix (live `atom/atom` lookup, so it needs network): 0 violations, 27 rules passed, 1 incomplete (color-contrast, 13 nodes).

### Scan coverage for error and cancel states

These run on every `npm run a11y` (no flag, no network). `/api/resurrect` is mocked with Playwright `page.route`, so the states are deterministic. The script throws, and the run fails, if a state is not actually reached: it waits for the exact status text, checks `aria-invalid="true"` on the input, checks the Cancel button is visible while running and gone after Escape, and checks the invalid-URL case made no request.

- Invalid URL ("not a url"): status text "Enter a public HTTP(S) URL…".
- Server error: mocked 404 with a fixed JSON error message shown in the status region.
- Running: request never completes; Cancel button visible.
- Canceled: Escape pressed; status text "Lookup canceled. You can start another one."

The color-contrast "needs review" nodes in these states are the same fog/glow-backed text as the initial page. The pixel-sampling measurement below was done for the initial page only and was not repeated for these states.

### Intentional findings: Lantern Hill "before"

`/fixtures/lantern-hill/before` is the deliberately broken 1999-style page that the demo restores. axe reports `blink`, `marquee`, `html-has-lang`, and `label` (two unlabeled inputs). These are the defects the restoration fixes; the "after" document has none. They are reported by the script but not counted as failures.

### Needs manual review: color-contrast on `/`

axe cannot compute a background for text sitting over the decorative fog/glow layers ("background gradient" / "overlapped by another element"), so it marks those nodes *incomplete* rather than passed. I did not treat that as a pass. Instead I rendered the home page with all text, borders and component backgrounds made transparent (fog animation running) and sampled the whole-page screenshot. The brightest backdrop pixel was `#33322d`. Against it:

- `text-stone-400` (`#a8a29e`, the dimmest text in use): 5.09:1 (AA needs 4.5:1)
- `text-stone-300`: 8.62:1
- `text-amber-200`: 10.31:1

So the flagged text meets AA by measurement, at the brightest point the fog reaches in that capture (the fog drifts; the capture waited 4 s, and I did not sample every animation phase). Some nodes were also "non-text characters" (decorative arrows, `aria-hidden`), which have no contrast requirement.

### A false positive worth knowing about

An earlier scan reported one `color-contrast` violation (2.13:1) on the revival-plan language chip. The cause was axe sampling the element mid-way through the 200 ms `fade-in` of the new accordion panel, not a real palette problem. The script now waits for finite animations to finish before scanning. No palette change was made.

### Not covered

- axe finds roughly a third of WCAG issues automatically; this is not a full conformance claim. No screen reader (VoiceOver/NVDA) pass was done.
- Only Chromium was scanned. The error and Cancel states are scanned with a mocked API; a real upstream failure was not scanned. The `Download proof` failure message (shown in its own status region) is covered by a unit test, not an axe scan.
- Reduced motion: confirmed by code (`motion-reduce:hidden` on fog, `motion-reduce:transition-none` on accordion chevrons, global `prefers-reduced-motion` reset in `globals.css`) and by unit tests for the fog; not visually re-verified in a browser with the OS setting on.

## Keyboard path (verified with Playwright key events on the built app)

| Step | Keys | Observed |
|---|---|---|
| Landing tab order | Tab ×9 | Skip link → logo → How it works → Source code → Try a real restoration → Restore a 1999-style page → URL input → Unearth project → `atom/atom` example |
| Search | Type, then Enter in the input (or Tab to the button and Enter/Space) | Lookup runs; the input and submit button are disabled while loading |
| Cancel | Escape while loading (or Tab to Cancel, Enter) | Status region announces "Lookup canceled. You can start another one." |
| Results | (automatic) | Focus moves to the "The excavation" heading when results arrive |
| Revival plan accordion | Tab to a section summary, Space or Enter | Toggles open/closed (verified: Space opened, Enter closed) |
| Receipt accordion | Tab to a receipt summary, Enter or Space | Expands the receipt details (Enter verified) |
| Verify proof | Focus button, Enter | Status region reports "internally consistent" |
| Download proof | Focus button, Space or Enter | `gravekeeper-proof.json` download starts (Space verified) |

Escape only has a meaning during a running lookup. The accordions are native `<details>`, which have no Escape behaviour; there are no modal dialogs in the app.
