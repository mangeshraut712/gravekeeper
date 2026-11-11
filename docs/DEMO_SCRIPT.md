# Gravekeeper — ~90 second demo script

Live URL: https://gravekeeper-drab.vercel.app

Target length: 90 s (≈ 215 spoken words at a relaxed pace). Record at 1440×900 with the browser zoom at 110%. Have a terminal open in the repo, and `gravekeeper-proof.json` ready to land in `~/Downloads`. Do a dry run first: the `atom/atom` lookup depends on GitHub and the Internet Archive and can be slow or return no snapshot; if the archive snapshot is missing, say so, because the partial result is the honest behaviour.

| Time | On screen | Say |
|---|---|---|
| 0:00–0:08 | https://gravekeeper-drab.vercel.app, fog drifting behind the hero | "Good code deserves a second life. Gravekeeper digs up abandoned projects, and keeps receipts for everything it finds." |
| 0:08–0:30 | Click the `atom/atom` example, press Enter. Results appear: tombstone card (last push, snapshot date, R.I.P.), open the "Revival steps" accordion | "I'll look up atom slash atom, an archived editor. It checks the Internet Archive and GitHub, then builds a revival checklist from public metadata. To be clear, this is a metadata plan, not a code audit." |
| 0:30–0:52 | Click **Download proof**. Switch to terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` → "Internally consistent: N receipts…" | "Every fetch is an Ed25519-signed, hash-chained receipt. I download the chain and verify it offline, with no server and no network. That proves internal integrity, not authorship." |
| 0:52–1:08 | Terminal: `npm run demo:verify` → 12/12. Then open `/restoration` | "Case one: the esrever string reverser, which breaks emoji. A segmenter-based rewrite passes twelve out of twelve fixtures; the original passes four." |
| 1:08–1:22 | Open `/lantern-hill`. Show before and after previews side by side | "Case two: a 1999-style page with blink and marquee becomes semantic, accessible HTML, with signed before-and-after receipts." |
| 1:22–1:30 | Back on home page. Toggle OS reduced motion on, fog disappears. End on the logo | "Everything respects reduced motion, and was built with Kiro for Kiroween." |

## Checklist before recording

- `npm run demo:verify` exits 0 locally.
- Reduced-motion toggle: System Settings → Accessibility → Display → Reduce motion (macOS).
- Do not enter private URLs; the lookup sends the URL to the Internet Archive and GitHub.
- Do not claim zero accessibility issues; see `docs/A11Y_AUDIT.md` for the real scan results.
- The video is not uploaded or submitted by this repository.
