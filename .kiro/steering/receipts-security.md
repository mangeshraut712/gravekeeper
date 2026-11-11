---
inclusion: fileMatch
fileMatchPattern: ["src/lib/receipts/**", "src/client/**", "scripts/verify-proof.ts"]
---

# Receipts and proof verification

Loaded when working on the receipt chain, the browser proof helpers, or the offline verifier. These files decide whether a downloaded proof is accepted, so a mistake here silently weakens the product's main claim.

## One scheme only

- Hashing is SHA-256 through `globalThis.crypto.subtle.digest`, exposed as `sha256hex()` in `src/lib/receipts/chain.ts`. Do not add a second hash function, a different encoding, or a third-party crypto package.
- Signing is Ed25519 through Web Crypto (`generateKeyPair`, `sign`, `verify`, `exportPublicKey`, `importPublicKey` in `src/lib/receipts/crypto.ts`). Public keys and signatures are base64url without padding.
- `canonicalJson()` is the only serialisation that is hashed or signed: sorted top-level keys, `JSON.stringify` with no whitespace, UTF-8 bytes. `hash` and `signature` are excluded from the bytes they cover.
- `prevHash` is `null` for `seq` 0 and the previous receipt's hash otherwise. `seq` equals the array index.

## Never weaken verification

- `verifyChain()` must keep checking all of: seq order, prevHash links, recomputed hash, and signature for every receipt. Do not short-circuit to "valid" on an empty or partial chain.
- `verifyProof()` in `src/client/proof.ts` must keep binding each `evidence[i].body` to `receipts[i].contentSha256` and to the displayed data (`wayback`, `github.meta`, `github.commits`, `spec`). A proof whose shown data differs from its signed evidence must fail.
- It must keep rejecting: empty receipts, evidence/receipt length mismatch, a first receipt whose `url` is not the expected resource, duplicate kinds, unknown kinds, both `wayback` and `wayback-miss`, and missing receipts for data that is present.
- `verifyReceiptExport()` in `src/lib/receipts/export.ts` (Lantern Hill format) must keep rejecting malformed or empty chains and checking artifact hashes for included artifacts.
- Verification failures return `false` or a typed failure result. Never throw out of the verifier to the UI, and never turn a caught error into success.
- `scripts/verify-proof.ts` exits 0 only for a valid `gravekeeper-proof-v1` file, 1 for invalid or unreadable input, 2 for missing arguments. Keep those codes; CI and the e2e smoke test rely on them.

## Isomorphic and credential-free

- These modules run in the browser and under Node's native TypeScript (`node scripts/verify-proof.ts`). Keep explicit relative `.ts` imports in this path, no `process.env`, no server-only imports, no network calls.
- Private keys exist only in memory for one request. Never log, return, or persist them.

## Honest wording

- A valid proof means internal consistency under the key embedded in the file. It does not prove authorship, upstream truth, or that later receipts were not removed. Keep UI and docs text consistent with this.

## Tests

- Every change here needs a regression in `chain.test.ts`, `crypto.test.ts`, `export.test.ts`, or `src/client/proof.test.ts`. Tamper cases (changed field, removed receipt, swapped evidence, bad signature) must keep failing.
