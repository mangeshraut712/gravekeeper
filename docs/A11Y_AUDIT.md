# Accessibility audit (WCAG 2.1 AA)

Run date: 2026-11-11 (refreshed for Firefox/WebKit and the contrast re-sample) · Tool: axe-core via `@axe-core/playwright` 4.14.0 · Browsers: Chromium 158.0.8127.18, Firefox 159.0, WebKit 27.2 (Playwright 1.65.0, headless) · Target: production build (`npm run build && next start -p 3100`).

Reproduce:

```bash
npm run build && npx next start -p 3100 &   # then wait a few seconds
npx playwright install chromium firefox webkit   # once
BASE_URL=http://localhost:3100 npm run a11y -- --lookup                              # Chromium (default)
BASE_URL=http://localhost:3100 npm run a11y -- --browsers=chromium,firefox,webkit --lookup
BASE_URL=http://localhost:3100 node scripts/contrast-sample.mts --lookup             # contrast re-sample (Chromium)
```

`--browser=<name>` or `--browsers=a,b,c` selects engines. A browser that cannot launch exits with code 2; nothing is skipped silently.

Rule tags scanned: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Preview iframes are excluded from the parent-page scan (sandboxed frames block the scanner) and their documents are scanned directly.

## Results by browser

One run of `npm run a11y -- --browsers=chromium,firefox,webkit --lookup` against the local production build, including the live `atom/atom` lookup in each browser. Every page and state below produced identical counts in all three engines.

| Browser | Counted violations | Notes |
|---|---|---|
| Chromium 158.0.8127.18 | 0 | plus the 4 intentional findings on the "before" fixture |
| Firefox 159.0 | 0 | same 4 intentional findings; see the animation-wait note below |
| WebKit 27.2 | 0 | same 4 intentional findings |

These are axe results only. They say nothing about screen readers, real-device behaviour, or layout differences between engines (no visual comparison was made).

Browser-specific issue found while adding this: in headless Firefox the 200 ms `fade-in` animation after a lookup never resolved its `finished` promise in the script's wait, which hung the `--lookup` scan indefinitely (the app itself rendered the results correctly; checked by reading the page text). The script's animation wait is now capped at 2 s plus a 300 ms pause, in all browsers. The earlier "wait until animations finish" guarantee is therefore "wait up to 2 s". No axe violation appeared in any browser after the cap, but a mid-fade sample in Firefox is not strictly ruled out.

## Results (per page and state; identical in all three browsers)

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

The color-contrast "needs review" nodes in these states are the same fog/glow-backed text as the initial page. The contrast re-sample for these states is in the next section.

### Intentional findings: Lantern Hill "before"

`/fixtures/lantern-hill/before` is the deliberately broken 1999-style page that the demo restores. axe reports `blink`, `marquee`, `html-has-lang`, and `label` (two unlabeled inputs). These are the defects the restoration fixes; the "after" document has none. They are reported by the script but not counted as failures.

### Needs manual review: color-contrast (re-sampled 2026-11-11, Chromium only)

axe cannot compute a background for text sitting over the decorative fog/glow layers, so it marks those nodes *incomplete* rather than passed. `scripts/contrast-sample.mts` measures them instead:

1. For each state, record the computed colour and page position of every visible text box (excluding `aria-hidden` content and text inside buttons, which paint their own background).
2. Make text, borders, shadows, outlines, placeholders and component backgrounds transparent and hide SVGs and buttons, so only the page backdrop and fog remain.
3. Take three full-page screenshots 1.5 s apart (the fog drifts) and, for each text box, find the brightest backdrop pixel inside its own rectangle.
4. Compute the WCAG contrast of the text colour (alpha-blended over that pixel) against it.

This replaces the first method, which used one page-wide brightest pixel (`#33322d`). That was cruder: a single bright pixel anywhere would penalise text that never sits near it. The earlier figures (5.09:1 / 8.62:1 / 10.31:1) were not copied; these are new measurements.

| State | Text boxes | Brightest backdrop under any text | Lowest ratio | Boxes under 4.5:1 |
|---|---|---|---|---|
| Initial | 42 | `#111510` | 7.13:1 (`#a6a09b` link "How it works") | 0 |
| Invalid-URL error | 43 | `#111510` | 7.13:1 | 0 |
| Mocked server error (404) | 43 | `#111510` | 7.13:1 | 0 |
| Running (Cancel visible) | 43 | `#111510` | 7.13:1 | 0 |
| Canceled | 43 | `#111510` | 7.13:1 | 0 |
| Live `atom/atom` result, receipts open | 167 | `#d6b12a` (see below) | 7.13:1 | 0 |

Caveats, so these numbers are not over-read:

- In the sampled frames the fog never reached the area under any text box; every backdrop was the flat page colour `#111510`, so the lowest ratio is the dimmest text colour (`#a6a09b`) on that colour. The fog does brighten other parts of the page (a whole-page pixel scan found values up to about `#55514c` in some states), and the fog drifts, so three frames are not every phase. Even at `#55514c`, `#a6a09b` is only about 3.05:1, so text placed over the brightest fog phase could fail. None of the measured text boxes was under it in the sampled frames.
- In the live result, the `#d6b12a` backdrop is under the "Open archived snapshot" link, which paints its own amber background (dark `#0c0a09` text, 9.58:1). It is not fog.
- The first run of this script produced misleading failures (amber/grey leftovers from placeholder text, underlines and the focused input). Those were measurement artefacts and were fixed in the script before the numbers above were taken.
- Contrast was only measured in Chromium. Decorative non-text characters (arrows) are `aria-hidden` and have no contrast requirement. Opacity set on a parent element is not accounted for beyond the computed text colour.

### A false positive worth knowing about

An earlier scan reported one `color-contrast` violation (2.13:1) on the revival-plan language chip. The cause was axe sampling the element mid-way through the 200 ms `fade-in` of the new accordion panel, not a real palette problem. The script now waits for finite animations to finish before scanning. No palette change was made.

### Not covered

- axe finds roughly a third of WCAG issues automatically; this is not a full conformance claim. No screen reader (VoiceOver/NVDA) pass was done.
- Firefox and WebKit were scanned with axe; no manual testing in them. The error and Cancel states are scanned with a mocked API; a real upstream failure was not scanned. The `Download proof` failure message (shown in its own status region) is covered by a unit test, not an axe scan.
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
