---
inclusion: fileMatch
fileMatchPattern: ["src/components/**", "src/app/**/*.tsx"]
---

# Accessibility rules for Gravekeeper UI

Loaded when editing components or pages. Target is WCAG 2.2 AA. The automated scan (`npm run a11y`, axe-core through Playwright) checks the WCAG 2.0/2.1 A and AA rule tags only, so the 2.2 items below are checked by review, not by the scanner. Results are recorded in `docs/A11Y_AUDIT.md`; do not claim zero violations for a state that was not scanned.

## Structure and names

- One `h1` per page; headings do not skip levels. Sections use `aria-labelledby` pointing at their heading (see `ReceiptChainViewer`, `TombstoneCard`).
- Every input has a visible `<label htmlFor>`. Help text is linked with `aria-describedby`.
- Decorative SVGs, arrows and glyphs (`→`, `↗`, `↓`, the graveyard art, `FogOverlay`) are `aria-hidden="true"`. Meaningful images need text alternatives.
- Link and button text must describe the action without its icon.

## Text, not colour alone

- Status is always stated in words ("Proof internally consistent…", "Before fails; after passes"). Colour (lime for valid, amber for warnings) is an extra cue only.
- Body text meets 4.5:1, large text 3:1, UI component boundaries 3:1 against `#111510`-range backgrounds. `text-stone-400` is the lightest muted text allowed on the dark panels.

## Keyboard and focus

- Everything works with keyboard alone. Use native `<button>`, `<a>`, `<details>/<summary>`, `<select>`; do not build custom widgets when a native one exists.
- Focus order follows reading order. The skip link (`#lookup`) stays first. After a lookup completes, focus moves to the results heading (`tabIndex={-1}`), not into the middle of the results.
- Focus indicators stay visible; do not remove outlines without a replacement. Interactive targets are at least 24×24 CSS px (WCAG 2.2 2.5.8); this project uses `min-h-11` on buttons.
- Escape cancels a running lookup. Any new long-running action needs a cancel path.
- Focused elements must not be hidden behind sticky or fixed content (WCAG 2.2 2.4.11). The fog overlay is `pointer-events-none` and decorative.

## Live regions

- Status and error text goes in a `role="status"` (polite) region that exists in the DOM before the message changes. Separate messages that can coexist get separate regions (see `ProofStatus`: verification and download error).
- `role="alert"` only for errors that interrupt a task the user just submitted.
- Mark busy regions with `aria-busy` while loading; set `aria-invalid` on the field that failed validation.

## Motion

- All animation uses `motion-safe:` or is hidden with `motion-reduce:hidden`. The global reduced-motion reset in `src/app/globals.css` stays.
- No flashing content. Fixture pages that are deliberately inaccessible (`/fixtures/lantern-hill/before`) are scanned and reported but stay isolated in sandboxed iframes.

## Verify

- Static-markup tests (`renderToStaticMarkup`) for roles, labels and `aria-*` attributes.
- `npm run a11y` against a production build for new states; `npm run e2e` checks reduced-motion fog hiding.
