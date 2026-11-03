/**
 * Receipt chain construction and verification.
 *
 * Canonical JSON spec (from design.md):
 *  1. Take the Receipt object WITHOUT `hash` and `signature`.
 *  2. Sort all top-level keys lexicographically.
 *  3. Serialise with JSON.stringify (no extra whitespace).
 *  4. Encode as UTF-8 bytes.
 *
 * The `hash` field is SHA-256(canonicalBytes) as lowercase hex.
 * The `signature` field is Ed25519Sign(canonicalBytes, privateKey) as base64url (no padding).
 */

import type { Receipt, ReceiptKind } from '@/types/index';
import { sign, verify } from './crypto';

// ---------------------------------------------------------------------------
// canonicalJson
// ---------------------------------------------------------------------------

/**
 * Produce a deterministic UTF-8 byte representation of an object.
 * Top-level keys are sorted lexicographically; no extra whitespace.
 */
export function canonicalJson(obj: Record<string, unknown>): Uint8Array {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  const json = JSON.stringify(sorted);
  return new TextEncoder().encode(json);
}

// ---------------------------------------------------------------------------
// sha256hex
// ---------------------------------------------------------------------------

/**
 * Hash a byte array with SHA-256 and return the lowercase hex digest.
 */
export async function sha256hex(data: Uint8Array): Promise<string> {
  const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', data as BufferSource);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// buildReceipt
// ---------------------------------------------------------------------------

/**
 * Build a new Receipt, appending it to an existing chain.
 *
 * @param prev          Previous receipt, or `null` for the chain head (seq 0).
 * @param kind          The kind of fetch this receipt records.
 * @param url           The external URL that was fetched.
 * @param responseBody  Raw bytes of the external response body (for contentSha256).
 * @param privateKey    Ed25519 private key for signing.
 */
export async function buildReceipt(
  prev: Receipt | null,
  kind: ReceiptKind,
  url: string,
  responseBody: Uint8Array,
  privateKey: CryptoKey,
): Promise<Receipt> {
  const seq = prev === null ? 0 : prev.seq + 1;
  const fetchedAt = new Date().toISOString();
  const contentSha256 = await sha256hex(responseBody);

  // Compute prevHash: SHA-256 of the previous receipt's canonical JSON
  let prevHash: string | null = null;
  if (prev !== null) {
    const prevCanonical = canonicalJson(prev as unknown as Record<string, unknown>);
    prevHash = await sha256hex(prevCanonical);
  }

  // Build the unsigned receipt (without hash and signature) to derive the hash
  const unsigned: Omit<Receipt, 'hash' | 'signature'> = {
    seq,
    prevHash,
    kind,
    url,
    fetchedAt,
    contentSha256,
  };

  const canonicalBytes = canonicalJson(
    unsigned as unknown as Record<string, unknown>,
  );
  const hash = await sha256hex(canonicalBytes);
  const signature = await sign(canonicalBytes, privateKey);

  return { ...unsigned, hash, signature };
}

// ---------------------------------------------------------------------------
// verifyChain
// ---------------------------------------------------------------------------

/**
 * Verify all receipts in a chain:
 *  1. Each receipt's `seq` equals its index.
 *  2. Each receipt's `prevHash` matches the SHA-256 of the full preceding receipt's canonical JSON.
 *  3. Each receipt's `hash` matches the SHA-256 of its own canonical JSON (without hash & signature).
 *  4. Each receipt's `signature` verifies against the provided public key.
 *
 * Returns `{ valid: true }` on success, or `{ valid: false, brokenAt: N }` where N is the
 * 0-based index of the first invalid receipt.
 */
export async function verifyChain(
  receipts: Receipt[],
  publicKey: CryptoKey,
): Promise<{ valid: boolean; brokenAt?: number }> {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];

    // 1. Seq monotonicity
    if (r.seq !== i) {
      return { valid: false, brokenAt: i };
    }

    // 2. prevHash linkage
    if (i === 0) {
      if (r.prevHash !== null) {
        return { valid: false, brokenAt: i };
      }
    } else {
      const prevCanonical = canonicalJson(
        receipts[i - 1] as unknown as Record<string, unknown>,
      );
      const expectedPrevHash = await sha256hex(prevCanonical);
      if (r.prevHash !== expectedPrevHash) {
        return { valid: false, brokenAt: i };
      }
    }

    // 3. Hash consistency — recompute over unsigned fields
    const { hash: _h, signature: _s, ...unsigned } = r;
    const canonicalBytes = canonicalJson(
      unsigned as unknown as Record<string, unknown>,
    );
    const expectedHash = await sha256hex(canonicalBytes);
    if (r.hash !== expectedHash) {
      return { valid: false, brokenAt: i };
    }

    // 4. Signature verification
    const sigValid = await verify(canonicalBytes, r.signature, publicKey);
    if (!sigValid) {
      return { valid: false, brokenAt: i };
    }
  }

  return { valid: true };
}
