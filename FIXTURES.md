# Demo fixtures

## Lantern Hill

| | |
|---|---|
| URL | `https://fixtures.gravekeeper.dev/lantern-hill/` |
| Source | `src/lib/restore/fixture.ts` |
| License | MIT, same as this repository |
| Kind | Original demo fixture |

Lantern Hill is an original late-1990s homepage written for Gravekeeper. The names, copy, and markup were created for this project. It is not a snapshot of a third-party site, not a fork of abandoned software, and not a Wayback Machine capture.

The before document keeps the old tags on purpose. `restoreDeadHtml()` in `src/lib/restore/html.ts` generates the after document. The after page is not a second hand-maintained copy.

Submitting this URL to `POST /api/resurrect` does not call the network.
