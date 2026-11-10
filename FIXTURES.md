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

Open `/lantern-hill` in the local app to compare the sandboxed before/after previews, inspect the changes, verify the signed HTML bytes in your browser, and download the receipt file. The fixture identifier above is a label, not a deployed site. The demo generates its documents locally without a Wayback or GitHub request. Live lookup through `/api/resurrect` stays separate.

The imported receipt-export format is distinct from the workbench's `gravekeeper-proof-v1`. Check a downloaded Lantern Hill receipt file locally with:

```sh
curl -s -X POST http://localhost:3000/api/verify \
  -H 'content-type: application/json' \
  --data @gravekeeper-lantern-hill-receipts.json
```

The verifier checks the embedded key, receipt links, signatures and any included HTML artifacts. It does not establish authorship or historical origin, and cannot detect replacement of the whole file/key or removal of a valid suffix. Keep an independently trusted final hash/key for stronger provenance. The HTML rewriter only processes this bundled fixture in the product; it is not an HTML sanitizer. No guestbook submissions are stored or sent.
