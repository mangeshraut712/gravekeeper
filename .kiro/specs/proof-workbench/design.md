# Proof Workbench — Design

```
/proof (Server Component, metadata)
  └─ ProofWorkbench (client)         src/components/ProofWorkbench.tsx
       ├─ file input / drop zone / textarea
       └─ analyzeProofText(text)      src/app/proof/analyze.ts   (pure, no DOM)
            ├─ gravekeeper-proof-v1 → verifyProof()          (src/client/proof.ts, unmodified)
            └─ receipt-export v1    → verifyReceiptExport()  (src/lib/receipts/export.ts)
```

`analyzeProofText` returns a discriminated union:

- `{ status: 'error', code, message }` — `too-large | invalid-json | not-object | unknown-format | missing-fields`
- `{ status: 'valid' | 'invalid', format, receipts, message }`

`receipts` is a display-only projection (strings and numbers copied from the file after type checks), so malformed entries cannot break rendering.

Because `src/client/proof.ts` is owned elsewhere, the wrapper lives in `src/app/proof/`. Files are read with `File.text()`; nothing is sent over the network. Size cap 5 MB checked before `JSON.parse`.

Navigation: a small `SiteFooter` in `layout.tsx` links Home, Restoration, Lantern Hill, Proof.

Limits shown in the UI: a fresh embedded key proves the file is self-consistent; replacing the whole file and key, or truncating a valid suffix, is undetectable without an external trust anchor.
