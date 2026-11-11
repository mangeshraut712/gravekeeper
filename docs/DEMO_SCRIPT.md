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

## Longer cut (~2:30 to 2:45, still under 3 minutes)

Same live URL: https://gravekeeper-drab.vercel.app. Same setup as above. About 400 spoken words at a relaxed pace; time a dry run and trim if it passes 2:50. No video has been recorded; this is a script only.

| Time | On screen | Say |
|---|---|---|
| 0:00-0:12 | Home page, fog drifting | "Good code deserves a second life. Gravekeeper looks up abandoned websites and GitHub repositories, and keeps a signed receipt of everything it fetches. I built it with Kiro for Kiroween, in the Resurrection category." |
| 0:12-0:40 | Click `atom/atom`, Enter. Wait for results. Show the tombstone card: last push, snapshot date, open issues | "I'll look up atom slash atom. It asks the Internet Archive for the latest snapshot and GitHub for public metadata and recent commits. If the Archive has no snapshot, the app says so and still returns the GitHub part. That partial result is intended." |
| 0:40-1:00 | Open the revival plan sections | "The plan comes from metadata only: language, archive status, how long since the last commit. It does not read dependency files and it is not a code audit. It is a checklist to start from." |
| 1:00-1:10 | Click "Fork on GitHub" (stop at GitHub's page, do not confirm) | "Forking opens GitHub's own page, where you confirm with your own account. The app never forks with a shared token." |
| 1:10-1:40 | Open a receipt in the proof section, click **Download proof**. Terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` | "Each fetch is an Ed25519-signed, SHA-256 chained receipt with the evidence attached. I verify the download offline: no server, no network. This shows the file is internally consistent. It does not prove authorship, and a fresh key is made for every lookup." |
| 1:40-2:05 | Terminal: `npm run demo:verify` (12/12). Open `/restoration` | "Case one: the MIT esrever string reverser, which splits emoji, flags and skin tones. A segmenter-based rewrite passes twelve of twelve fixtures. The original passes four. It is one curated function, not an automatic repair tool." |
| 2:05-2:25 | Open `/lantern-hill`, show before and after side by side | "Case two: an original 1999-style page with blink and marquee, rewritten into semantic HTML with signed before-and-after receipts. The before page is deliberately broken, and the scanner flags it." |
| 2:25-2:40 | Home page, toggle OS reduced motion; fog disappears | "Motion is optional. Automated axe scans found no violations on the product pages in Chromium, but that is not full conformance: I have not done a screen reader pass." |
| 2:40-2:45 | Logo | "Built with Kiro CLI: steering, a spec, property tests, and a read-only review agent." |

Do not describe hooks, MCP servers, powers or Crew as used in the video; the repo does not show them running.

## Checklist before recording

- `npm run demo:verify` exits 0 locally.
- Reduced-motion toggle: System Settings → Accessibility → Display → Reduce motion (macOS).
- Do not enter private URLs; the lookup sends the URL to the Internet Archive and GitHub.
- Do not claim zero accessibility issues; see `docs/A11Y_AUDIT.md` for the real scan results.
- The video is not uploaded or submitted by this repository.
