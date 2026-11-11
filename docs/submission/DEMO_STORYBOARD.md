# Demo storyboard (draft)

Draft only. No video has been recorded or uploaded, and nothing here has been submitted or posted. The spoken lines are short forms of the lines in [../DEMO_SCRIPT.md](../DEMO_SCRIPT.md); if the two disagree, the script wins.

"Reference shot" names a screenshot that exists in this repository. Production shots in `docs/screenshots/live/` were captured on https://gravekeeper-drab.vercel.app at about 13:16–13:17 UTC on 2026-11-11 (see [the caption file](../screenshots/live/README.md)). "None yet" means no screenshot of that beat exists; capture it while recording. Reference shots show what the screen looked like once, not what it will show on the day: a live `atom/atom` lookup depends on GitHub, the Internet Archive and npm, and its numbers change.

In the 13:17 UTC production lookup the Wayback availability API said "None found" while the Epitaph panel showed born Jun 22, 2014, last seen Oct 2026, 136 captured months. If the snapshot is missing again, say so on camera: a partial result is the intended behaviour.

## Title card

```
GRAVEKEEPER
Good code deserves a second life.

Unearth abandoned repositories and websites.
Keep signed receipts of everything found.

Kiroween 2026 · Resurrection
gravekeeper-drab.vercel.app
```

Hold for about 2 seconds before 0:00 or overlay it on the first home-page shot. Use the site's own colours (background `#111510`, amber `#fde68a`); no new artwork exists for it.

## 90-second cut

| # | Time | On screen | Say (short) | Reference shot |
|---|---|---|---|---|
| 1 | 0:00–0:08 | Home page, fog drifting | "Good code deserves a second life. Gravekeeper digs up abandoned projects and keeps receipts." | `docs/screenshots/live/home-1440.png` |
| 2 | 0:08–0:18 | Click `atom/atom`, then **Unearth project**; "Lookup complete" and the tombstone card | "Atom, an archived editor. GitHub metadata, commits, and the Archive's answer." | `docs/screenshots/live/home-lookup-atom-1440.png` |
| 3 | 0:18–0:27 | Scroll to the **Epitaph** panel | "The Archive's capture index: born 2014, last seen this year." | `docs/screenshots/live/home-lookup-atom-epitaph.png` |
| 4 | 0:27–0:35 | Scroll to the **Dependency autopsy** table | "Its package.json against npm, first forty packages, declared versions only." | `docs/screenshots/live/home-lookup-atom.png` (full page; no viewport-sized autopsy shot) |
| 5 | 0:35–0:50 | Revival plan, then **Download revival kit**; status line shows `REVIVAL.md downloaded` | "A checklist, not a repair. The kit holds the steps, a tracking issue and the proof hash." | `docs/screenshots/live/home-lookup-atom-kit.png` (before pressing; no shot of the status message) |
| 6 | 0:50–1:08 | **Download proof**; `/proof`, choose the file, "Valid"; terminal `node scripts/verify-proof.ts …` | "Signed, hash-chained receipts. Checked in the browser and offline. Not edited, not proof of who wrote it." | `docs/screenshots/live/proof-1440.png` (empty state only; no Valid verdict or terminal shot) |
| 7 | 1:08–1:22 | Terminal `npm run demo:verify` (12/12); `/restoration`; `/lantern-hill` | "Two restorations: twelve of twelve against four, and a 1999 page in semantic HTML." | `docs/screenshots/live/restoration-1440.png`, `docs/screenshots/live/lantern-hill-1440.png` |
| 8 | 1:22–1:30 | Home page, turn on OS reduced motion; fog stops. End on the logo | "Motion is optional. Built with Kiro, spec first." | `docs/screenshots/home-reduced-motion.png` (local build, not production) |

## Longer cut (2:30–2:45)

| # | Time | On screen | Say (short) | Reference shot |
|---|---|---|---|---|
| 1 | 0:00–0:12 | Title card, then home page with fog | "Abandoned sites and repos, with a signed receipt for every fetch. Built with Kiro for Kiroween." | `docs/screenshots/live/home-1440.png` |
| 2 | 0:12–0:35 | `atom/atom`, **Unearth project**; tombstone card: last push, snapshot, open issues | "Archive snapshot plus GitHub metadata and commits. A missing source is reported, not hidden." | `docs/screenshots/live/home-lookup-atom-1440.png` |
| 3 | 0:35–0:55 | **Epitaph** panel; press Enter on "Show captures per year as a table" | "First capture, last month seen, months per year. The chart has a table version." | `docs/screenshots/live/home-lookup-atom-epitaph.png` (table closed; no shot with it open) |
| 4 | 0:55–1:15 | **Dependency autopsy** table, then the revival plan | "Declared versions against npm: current, minor, major behind, unknown. Not a vulnerability scan." | `docs/screenshots/live/home-lookup-atom.png` |
| 5 | 1:15–1:28 | **Download revival kit**, then **Copy issue body**; both status lines | "Plan, autopsy, timeline, tracking issue and proof hash. Refused if the proof fails." | `docs/screenshots/live/home-lookup-atom-kit.png` (before pressing) |
| 6 | 1:28–1:35 | **Fork on GitHub**; stop on GitHub's page, do not confirm | "GitHub's own fork page, your own account. No shared token." | None yet |
| 7 | 1:35–2:00 | **Copy link**; **Download proof**; `/proof` Valid; terminal verifier | "A permalink. Receipts with evidence attached; an edited number fails. Integrity, not authorship." | `docs/screenshots/live/proof-1440.png` (empty state only) |
| 8 | 2:00–2:18 | Terminal `npm run demo:verify`; `/restoration` | "Esrever splits emoji. The rewrite passes twelve of twelve; the original, four." | `docs/screenshots/live/restoration-1440.png` |
| 9 | 2:18–2:32 | `/lantern-hill`, before and after | "A 1999 page with blink and marquee, rebuilt as semantic HTML with signed receipts." | `docs/screenshots/live/lantern-hill-1440.png` |
| 10 | 2:32–2:42 | Reduced motion on; fog stops | "Motion is optional. axe found no counted violations in three browsers. No screen-reader pass yet." | `docs/screenshots/home-reduced-motion.png` (local build) |
| 11 | 2:42–2:48 | Logo | "Steering, specs before code, property tests, review agents." | `docs/screenshots/live/home-1440.png` |

For a 375 px cutaway (optional, either cut), `docs/screenshots/live/home-375.png` exists.

## Recording checklist (draft)

- [ ] Dry run of the whole cut; trim if the longer cut passes 2:50.
- [ ] Browser at 1440x900, zoom 110%, no extensions or bookmarks bar visible, notifications off.
- [ ] Use only public URLs on camera (`atom/atom`). Do not show tokens, `.env` files, shell history or other tabs.
- [ ] `npm run demo:verify` exits 0 in the terminal before recording; terminal font large enough to read.
- [ ] Clear `~/Downloads/gravekeeper-proof.json` and `REVIVAL.md` from earlier runs so the verifier reads the new file.
- [ ] If GitHub rate-limits the anonymous lookup (60 requests/hour), wait or run the same steps on a local production build, and say which one is on screen.
- [ ] Reduced motion: System Settings → Accessibility → Display → Reduce motion (macOS).
- [ ] Do not say a hook ran tests, that Kiro called an MCP tool, or that the app is WCAG conformant. Do not claim a screen-reader pass.
- [ ] Upload, Devpost submission and any social post are done by the owner, not by this repository. YouTube URL: ______
