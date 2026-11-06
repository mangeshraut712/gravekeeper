# Gravekeeper

Gravekeeper is a [Kiroween](https://kiroween.devpost.com/) **Resurrection** project. It brings a dead page back as something you can read, and it leaves a signed record of what it saw.

The obsolete technology here is the late-1990s personal homepage: layout tables, `<font>`, `<center>`, `<marquee>`, `<blink>`, a `mailto:` guestbook, and a `document.write` script. Gravekeeper restores one small example of that page into semantic HTML, and it keeps the older lookup path for live URLs.

## What you can do

- **Resurrect the bundled example.** Submit the Lantern Hill fixture. The app shows the 1999 page beside the restored HTML, lists each rewrite, and lets you open or download the restored document.
- **Look up a live URL.** Any other `http` or `https` URL still goes to the Wayback Machine Availability API. A GitHub repository URL also fetches metadata and recent commits, then builds a revival checklist. That path does not rewrite someone else's source.
- **Keep a receipt.** Every run mints an Ed25519 key and a SHA-256 hash chain. Export the chain as JSON. Verify it in the browser, or `POST` it to `/api/verify`. A changed byte fails the check.
- **Fork, when a token is configured.** `POST /api/fork` creates a GitHub fork only if `GITHUB_TOKEN` is set. Without it the route returns 503, and the button on the page stays disabled. The Lantern Hill demo does not need a token.

## Lantern Hill fixture

`https://fixtures.gravekeeper.dev/lantern-hill/` is **original demo content** written for this repository. It imitates a personal homepage last updated 14 March 1999. It is not a copy of a copyrighted site, an abandoned project, or a Wayback capture. It is covered by the MIT license on this repository. See [FIXTURES.md](FIXTURES.md).

The fixture path never calls the Wayback Machine or GitHub. The historical page is served at `/fixtures/lantern-hill/before`. The restored page is served at `/fixtures/lantern-hill/after`.

## Run it locally

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The URL field is already filled with the Lantern Hill fixture.

1. Press **Resurrect**.
2. Read the before frame and the restored frame. Use **Open** to view either document on its own, or **Download restored HTML**.
3. Press **Export receipt chain** and save `gravekeeper-receipts.json`.
4. Press **Verify this chain**. Verification runs in the browser with WebCrypto.
5. Press **Verify a tampered copy** to see the same file fail after one field changes.
6. To check a file from another machine, send it to the app:

```bash
curl -s -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  --data @gravekeeper-receipts.json
```

A live URL, for example `https://example.com`, still returns a Wayback result (or a recorded miss) and a verifiable receipt chain. A GitHub URL such as `https://github.com/owner/repo` adds repository metadata when the GitHub API responds.

```bash
npm run build
npm start
```

`GITHUB_TOKEN` is optional. Set it only if you want higher GitHub rate limits or fork creation. Do not commit it.

## Tests

```bash
npm test
```

Vitest covers the receipt chain, the Lantern Hill restoration, the resurrect route (including a no-network fixture run), and `/api/verify`.

## Kiro

Specs, steering, hooks, MCP settings, and the gravekeeper agent live in [`.kiro/`](.kiro/). How those files were produced, and what this milestone added without a new Kiro session, is in [KIRO_USAGE.md](KIRO_USAGE.md).

## License

[MIT](LICENSE). Copyright (c) 2026 Mangesh Raut.
