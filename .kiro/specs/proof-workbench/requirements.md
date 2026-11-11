# Proof Workbench — Requirements

A page at `/proof` where a visitor checks a downloaded Gravekeeper proof file in their own browser.

## Scope

- Accepts `gravekeeper-proof-v1` (live lookup export, `exportProof`) and `receipt-export` v1 (Lantern Hill receipts, `buildReceiptExport`).
- Reuses `src/client/proof.ts` (`verifyProof`) and `src/lib/receipts/export.ts` (`verifyReceiptExport`). No second hashing scheme.
- Verification means internal consistency only. It does not prove authorship, or that GitHub or the Internet Archive said what the file claims.

## Acceptance criteria (EARS)

1. **[Ubiquitous]** The page SHALL offer a file input, a drop zone, and a paste area, each operable by keyboard alone.
2. **[State-driven]** WHILE no proof has been provided, the page SHALL show an empty state that says nothing has been checked and SHALL NOT show a valid or invalid result.
3. **[Event-driven]** WHEN the visitor selects, drops or pastes a proof, the page SHALL parse and verify it using client-side code only and SHALL NOT send the file or its text to any server.
4. **[Event-driven]** WHEN verification succeeds, the page SHALL show "Valid" with the receipt list (seq, kind, url, fetchedAt, hash, payload digest) and the internal-consistency limits.
5. **[Event-driven]** WHEN verification fails, the page SHALL show "Invalid" with the receipt list as written in the file, and SHALL NOT claim which edit caused it unless the verifier reported a broken position.
6. **[Unwanted]** IF the text is not JSON, is larger than 5 MB, is not an object, has an unrecognised format, or lacks required fields, THEN the page SHALL show a specific error and SHALL NOT show Valid or Invalid.
7. **[Ubiquitous]** Results and errors SHALL be announced through a `role="status"` live region.
8. **[Ubiquitous]** The drop zone highlight SHALL NOT rely on motion; any transition SHALL use `motion-safe:`.
9. **[Ubiquitous]** The site chrome SHALL link to `/proof`.
10. **[Unwanted]** IF the browser lacks Ed25519 WebCrypto, THEN verification SHALL report Invalid or an unavailable-cryptography error rather than a pass.
