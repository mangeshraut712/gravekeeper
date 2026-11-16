# Gravekeeper — demo scripts

Live URL: https://gravekeeper-drab.vercel.app

Two cuts, both under 3 minutes. No video has been recorded; these are scripts only. Every feature shown is on `main`. The revival kit (merged in PR #12, `7a55157`) was present in the production JavaScript at 13:06:49 UTC on 2026-11-11. If a deploy lags, run the same steps on a local production build.

Record at 1440×900 with the browser zoom at 110%. Have a terminal open in the repo, and let `gravekeeper-proof.json` land in `~/Downloads`. Do a dry run first. The `atom/atom` lookup depends on GitHub (anonymous limit, 60 requests/hour shared by all visitors), the Internet Archive and npm, so it can be slow or partial. On 2026-11-11 at 12:38 UTC a production lookup got "no archived snapshot" from the Wayback availability API while the CDX index returned a full timeline. If a source is missing on the day, say so: the partial result is the intended behaviour. With the CDX snapshot fallback, an availability miss still shows a capture from the latest captured month when the index has one (the card says so); this is tested with mocks and was not seen live.

## Short cut (~90 s, about 220 spoken words)

| Time | On screen | Say |
|---|---|---|
| 0:00–0:08 | Home page, fog drifting behind the hero | "Good code deserves a second life. Gravekeeper digs up abandoned projects, and keeps receipts for everything it finds." |
| 0:08–0:35 | Click the `atom/atom` example, then **Unearth project**. Show the tombstone card, then the **Epitaph** panel, then the **Dependency autopsy** table | "I'll look up atom slash atom, an archived editor. The Internet Archive's index shows when the page was born and last seen. The autopsy reads its package.json and compares each dependency with npm. It checks the first forty, from declared versions only." |
| 0:35–0:50 | Open the revival plan, then **Download revival kit** (saves `REVIVAL.md`) | "The plan turns that into named upgrade steps — a checklist, not an automatic repair. The revival kit is a markdown file with those steps, a tracking issue, and the proof hash." |
| 0:50–1:08 | Click **Download proof**. Open `/proof`, choose the file: "Valid: internally consistent". Terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` | "Every answer is an Ed25519-signed, hash-chained receipt. I check the proof in the browser without uploading it, and offline in the terminal. That proves the file wasn't edited, not who wrote it." |
| 1:08–1:22 | Terminal: `npm run demo:verify` (12/12). Open `/restoration`, then `/lantern-hill` | "Two worked restorations: an emoji-safe rewrite of the esrever string reverser, twelve of twelve fixtures against four, and a 1999 page rebuilt as semantic HTML with signed receipts." |
| 1:22–1:30 | Home page, toggle OS reduced motion; fog disappears. End on the logo | "Motion is optional. Built with Kiro, spec first, for Kiroween." |

## Longer cut (~2:30 to 2:45)

About 400 spoken words at a relaxed pace; time a dry run and trim if it passes 2:50.

| Time | On screen | Say |
|---|---|---|
| 0:00-0:12 | Home page, fog drifting | "Good code deserves a second life. Gravekeeper looks up abandoned websites and GitHub repositories, and keeps a signed receipt of everything it fetches. I built it with Kiro for Kiroween, in the Resurrection category." |
| 0:12-0:35 | Click `atom/atom`, **Unearth project**. Show the tombstone card: last push, snapshot date, open issues | "I'll look up atom slash atom. It asks the Internet Archive for the latest snapshot, and GitHub for public metadata and recent commits. If a source has nothing or times out, the app says so and keeps the rest." |
| 0:35-0:55 | **Epitaph** panel; open its table | "The Epitaph comes from the Archive's capture index: first capture, last month seen, and captured months per year. The chart has a table version. It's month resolution, for this exact URL only." |
| 0:55-1:15 | **Dependency autopsy** table, then the revival plan | "The autopsy reads the root package.json, compares each declared version with the npm registry, and labels it current, minor behind, major behind or unknown. It checks forty at most, uses declared versions only, and is not a vulnerability scan. The plan names the upgrades." |
| 1:15-1:28 | **Download revival kit**, then **Copy issue body** | "The revival kit is a markdown file with the plan, the autopsy, the timeline, a ready-to-paste tracking issue, and the SHA-256 of the proof. Copy issue body copies just that issue. Both are refused if the proof does not verify." |
| 1:28-1:35 | Click **Fork on GitHub** (stop at GitHub's page, do not confirm) | "Forking opens GitHub's own page, under your own account. The app never forks with a shared token." |
| 1:35-2:00 | **Copy link** (permalink). **Download proof**. Open `/proof`, choose the file. Terminal: `node scripts/verify-proof.ts ~/Downloads/gravekeeper-proof.json` | "Copy link gives a permalink that reruns this lookup. Each answer is an Ed25519-signed, SHA-256 chained receipt with its evidence attached. The browser checker and the offline verifier both rebuild the autopsy and the timeline from that evidence, so an edited number fails. This proves the file is internally consistent. It doesn't prove authorship, and every lookup gets a fresh key." |
| 2:00-2:18 | Terminal: `npm run demo:verify` (12/12). Open `/restoration` | "Case one: the MIT esrever string reverser, which splits emoji, flags and skin tones. A segmenter-based rewrite passes twelve of twelve fixtures. The original passes four." |
| 2:18-2:32 | Open `/lantern-hill`, before and after side by side | "Case two: an original 1999-style page with blink and marquee, rewritten into semantic HTML with signed before-and-after receipts." |
| 2:32-2:42 | Home page, toggle OS reduced motion; fog disappears | "Motion is optional. Automated axe scans found no violations on the scanned pages in three browsers, but I haven't done a screen reader pass." |
| 2:42-2:48 | Logo | "Built with Kiro CLI: steering, specs written before code, property tests, and review agents." |

## Claims to keep out of the video

- Do not say a hook ran tests, or that Kiro called an MCP tool. The evidence files record agent-prompt hooks and the pre-release gate firing, not the `npm test` hook's result, and only a direct probe of the MCP servers. Powers and Crew were not used.
- Do not claim zero accessibility issues or WCAG conformance; see `docs/A11Y_AUDIT.md`.
- The live button label is **Unearth project**, not Resurrect. Do not claim the kit is a second signature; it only names the proof hash and is refused if verification fails.

## Checklist before recording

- `npm run demo:verify` exits 0 locally.
- Reduced-motion toggle: System Settings → Accessibility → Display → Reduce motion (macOS).
- Do not enter private URLs; the lookup sends the URL to the Internet Archive, GitHub and npm or PyPI.
- The video is not uploaded or submitted by this repository. YouTube URL: ______
