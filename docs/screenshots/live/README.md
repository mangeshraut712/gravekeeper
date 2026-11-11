# Production screenshots (2026-11-11)

Captured from the live production site, https://gravekeeper-drab.vercel.app, at about 13:16–13:17 UTC on 2026-11-11 (file times 18:46–18:47 IST), at a 1440x900 viewport unless noted. They were captured before this branch; the files were copied in unchanged apart from one rename (`home-lookup-atom-epitaph-autopsy.png` became `home-lookup-atom-epitaph.png`, because that viewport shows the tombstone card and the Epitaph panel, not the autopsy table).

The lookup is a real `POST /api/resurrect` for `https://github.com/atom/atom`, not mocked. At that moment the Wayback availability API returned no snapshot, so the tombstone card says **Archive snapshot: None found** and the first receipt is `wayback-miss`. The Internet Archive CDX index did answer, so the Epitaph panel shows **Born Jun 22, 2014**, **Last seen Oct 2026**, 13 years on record and **136** captured months. A rerun can return different data.

| File | What it shows |
|---|---|
| `home-1440.png` | Home page at load. |
| `home-375.png` | Home page at load, 375x812. |
| `home-lookup-atom-1440.png` | Search form with `https://github.com/atom/atom`, "Lookup complete", Copy link, and the top of the tombstone card (last push Jan 3, 2023; snapshot None found; 60,692 stars; 993 open issues / PRs; MIT). |
| `home-lookup-atom-epitaph.png` | Tombstone card and the Epitaph panel with its bar chart, collapsed table disclosure and trust note. |
| `home-lookup-atom-kit.png` | End of the revival plan (steps 12 and 13) and the "Take the plan home" revival kit panel with **Download revival kit** and **Copy issue body**. Neither button had been pressed. |
| `home-lookup-atom.png` | Full page, 1440x6028. Includes the Dependency autopsy (package.json, npm; "Showing the first 40 of 157 declared packages"; 5 major behind, 3 minor behind, 10 current, 22 unknown, 0 not found), the 13-step plan, and the 7 receipts (`wayback-miss`, `wayback-cdx`, `github-meta`, `github-commits`, `github-manifest`, `registry`, `spec`). |
| `proof-1440.png` | `/proof` in its empty state ("No proof checked yet"). No proof file had been loaded, so there is no verdict in this shot. |
| `restoration-1440.png` | `/restoration`: pinned upstream 4/12, modernized 12/12, 8 new cases fixed. |
| `lantern-hill-1440.png` | `/lantern-hill`: the 1999-style "before" fixture beside the generated HTML5 "after". |

Not captured on production: a `/proof` page with a Valid or Invalid verdict, the autopsy table at viewport size, the Epitaph table opened, the kit status messages after a download or copy, reduced motion, and any terminal output. The mocked screenshots in `docs/screenshots/` stay labelled as mocked. The first four of those were later captured on a local production build; see the next section.

## Storyboard stills (`storyboard/`, local production build, 2026-11-11)

These are **not** production captures. They were taken from a local production build of branch `feat/contrast-and-storyboard-stills-20261111` (`npm run build && npx next start -p 3471`, http://localhost:3471) at about 13:47–13:48 UTC on 2026-11-11, with `BASE_URL=http://localhost:3471 node scripts/capture-storyboard-stills.mts --live`. Chromium (Playwright 1.65.0), 1440x900 viewport, reduced motion on, so the fog is hidden. The script waits for each state and throws if it is not reached.

Each beat has two files:

- `-synthetic.png`: `/api/resurrect` is mocked in the browser with the SYNTHETIC signed lookup from `scripts/synthetic-lookup.mts` (`example/abandoned-widget`, invented data). No network.
- `-atom.png`: a REAL lookup of `https://github.com/atom/atom` through the local server, which called GitHub, the Internet Archive and npm. In this run the Wayback availability API did return a snapshot (first receipt `wayback`, unlike the production captures above), the Epitaph showed born Jun 22, 2014, last seen Oct 2026, 13 years, 136 captured months, and the autopsy showed "Showing the first 40 of 157 declared packages" with 5 major behind, 3 minor behind, 10 current, 22 unknown, 0 not found. A rerun can differ.

| File | What it shows |
|---|---|
| `storyboard/epitaph-table-open-{synthetic,atom}.png` | Epitaph panel with "Show captures per year as a table" opened (clicked) and the year table visible. |
| `storyboard/autopsy-table-{synthetic,atom}.png` | Dependency autopsy panel scrolled to the top of the viewport: summary counts and the first table rows with status badges. |
| `storyboard/kit-status-{synthetic,atom}.png` | Revival kit panel after **Download revival kit** and **Copy issue body** were pressed, with both status lines: "REVIVAL.md downloaded. Proof SHA-256 …" and "Issue body copied." (atom run: proof SHA-256 starting `0bc6154ec49e`). |
| `storyboard/proof-valid-{synthetic,atom}.png` | `/proof` showing "Valid: internally consistent". Synthetic: the synthetic proof JSON pasted and verified. atom: the file saved from **Download proof** in the same session, loaded through the file input. That same file also passed `node scripts/verify-proof.ts` ("Internally consistent: 7 receipts and their evidence verified."). |

Valid means the file is consistent with itself under its embedded key; it does not show that GitHub or the Archive said what the file records.
