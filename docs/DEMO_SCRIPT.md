# Gravekeeper — demo scripts

Live URL: https://gravekeeper-drab.vercel.app

Two cuts, both under 3 minutes. No video has been recorded; these are scripts only. Every feature shown is on `main` and on production. The revival kit (PR #12) is open and not merged, so it is not in either script.

Record at 1440×900 with the browser zoom at 110%. Have a terminal open in the repo, and let `gravekeeper-proof.json` land in `~/Downloads`. Do a dry run first. The `atom/atom` lookup depends on GitHub (anonymous limit, 60 requests/hour shared by all visitors), the Internet Archive and npm, so it can be slow or partial. On 2026-11-11 at 12:38 UTC a production lookup got "no archived snapshot" from the Wayback availability API while the CDX index returned a full timeline. If a source is missing on the day, say so: the partial result is the intended behaviour.

## Short cut (~90 s, about 220 spoken words)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:08 | Home page, fog drifting behind the hero | "Good code deserves a second life. Gravekeeper digs up abandoned projects, and keeps receipts for everything it finds." |
| 0:08–0:35 | Click the `atom/atom` example, then **Resurrect**. Show the tombstone card, then the **Epitaph** panel, then the **Dependency autopsy** table | "I'll look up atom slash atom, an archived editor. The Internet Archive's index shows when the page was born and last seen. The autopsy reads its package.json and compares each dependency with npm. It checks the first forty, from declared versions only." |
| 0:35–0:45 | Open the revival plan | "The plan turns that into named upgrade steps. It's a checklist, not an automatic repair." |
| 0:45–1:05 | Click **Download proof**. Open `/proof`, choose the file: "Valid: internally consistent". Terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` | "Every answer is an Ed25519-signed, hash-chained receipt. I check the proof in the browser without uploading it, and offline in the terminal. That proves the file wasn't edited, not who wrote it." |
| 1:05–1:20 | Terminal: `npm run demo:verify` (12/12). Open `/restoration`, then `/lantern-hill` | "Two worked restorations: an emoji-safe rewrite of the esrever string reverser, twelve of twelve fixtures against four, and a 1999 page rebuilt as semantic HTML with signed receipts." |
| 1:20–1:30 | Home page, toggle OS reduced motion; fog disappears. End on the logo | "Motion is optional. Built with Kiro, spec first, for Kiroween." |

## Longer cut (~2:30 to 2:45)

About 400 spoken words at a relaxed pace; time a dry run and trim if it passes 2:50.

| Time | On screen | Say |
|---|---|---|
| 0:00-0:12 | Home page, fog drifting | "Good code deserves a second life. Gravekeeper looks up abandoned websites and GitHub repositories, and keeps a signed receipt of everything it fetches. I built it with Kiro for Kiroween, in the Resurrection category." |
| 0:12-0:35 | Click `atom/atom`, **Resurrect**. Show the tombstone card: last push, snapshot date, open issues | "I'll look up atom slash atom. It asks the Internet Archive for the latest snapshot, and GitHub for public metadata and recent commits. If a source has nothing or times out, the app says so and keeps the rest." |
| 0:35-0:55 | **Epitaph** panel; open its table | "The Epitaph comes from the Archive's capture index: first capture, last month seen, and captured months per year. The chart has a table version. It's month resolution, for this exact URL only." |
| 0:55-1:20 | **Dependency autopsy** table, then the revival plan | "The autopsy reads the root package.json, compares each declared version with the npm registry, and labels it current, minor behind, major behind or unknown. It checks forty at most, uses declared versions only, and is not a vulnerability scan. The plan names the upgrades." |
| 1:20-1:28 | Click **Fork on GitHub** (stop at GitHub's page, do not confirm) | "Forking opens GitHub's own page, under your own account. The app never forks with a shared token." |
| 1:28-1:55 | **Copy link** (permalink). **Download proof**. Open `/proof`, choose the file. Terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` | "Copy link gives a permalink that reruns this lookup. Each answer is an Ed25519-signed, SHA-256 chained receipt with its evidence attached. The browser checker and the offline verifier both rebuild the autopsy and the timeline from that evidence, so an edited number fails. This proves the file is internally consistent. It doesn't prove authorship, and every lookup gets a fresh key." |
| 1:55-2:15 | Terminal: `npm run demo:verify` (12/12). Open `/restoration` | "Case one: the MIT esrever string reverser, which splits emoji, flags and skin tones. A segmenter-based rewrite passes twelve of twelve fixtures. The original passes four." |
| 2:15-2:30 | Open `/lantern-hill`, before and after side by side | "Case two: an original 1999-style page with blink and marquee, rewritten into semantic HTML with signed before-and-after receipts." |
| 2:30-2:40 | Home page, toggle OS reduced motion; fog disappears | "Motion is optional. Automated axe scans found no violations on the scanned pages in three browsers, but I haven't done a screen reader pass." |
| 2:40-2:45 | Logo | "Built with Kiro CLI: steering, specs written before code, property tests, and review agents." |

## Claims to keep out of the video

- Do not say a hook ran tests, or that Kiro called an MCP tool. The evidence files record agent-prompt hooks and the pre-release gate firing, not the `npm test` hook's result, and only a direct probe of the MCP servers. Powers and Crew were not used.
- Do not claim zero accessibility issues or WCAG conformance; see `docs/A11Y_AUDIT.md`.
- Do not show the revival kit until PR #12 is merged and deployed.

## Checklist before recording

- `npm run demo:verify` exits 0 locally.
- Reduced-motion toggle: System Settings → Accessibility → Display → Reduce motion (macOS).
- Do not enter private URLs; the lookup sends the URL to the Internet Archive, GitHub and npm or PyPI.
- The video is not uploaded or submitted by this repository. YouTube URL: ______
