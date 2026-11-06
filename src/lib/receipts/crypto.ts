/**
 * Receipt cryptography using Web Crypto API (Ed25519).
 * Keys are ephemeral — generated per session, never persisted.
 */

/**
 * Generate an Ed25519 key pair for signing receipts.
 */
export async function generateKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKey: CryptoKey;
}> {
  return globalThis.crypto.subtle.generateKey(
    { name: 'Ed25519' } as KeyAlgorithm,
    true,
    ['sign', 'verify'],
  ) as Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }>;
}

/**
 * Export a public key as a base64url-encoded string (no padding).
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await globalThis.crypto.subtle.exportKey('raw', publicKey);
  return uint8ArrayToBase64Url(new Uint8Array(raw));
}

/**
 * Import a raw Ed25519 public key from the base64url form produced by
 * `exportPublicKey`. Used to verify an exported receipt chain offline.
 */
export async function importPublicKey(b64url: string): Promise<CryptoKey> {
  const bytes = base64UrlToUint8Array(b64url);
  return globalThis.crypto.subtle.importKey(
    'raw',
    bytes as BufferSource,
    { name: 'Ed25519' } as KeyAlgorithm,
    true,
    ['verify'],
  );
}

/**
 * Sign a byte array with an Ed25519 private key.
 * Returns the signature as a base64url string (no padding).
 */
export async function sign(
  data: Uint8Array,
  privateKey: CryptoKey,
): Promise<string> {
  const sigBuf = await globalThis.crypto.subtle.sign(
    'Ed25519' as AlgorithmIdentifier,
    privateKey,
    data as BufferSource,
  );
  return uint8ArrayToBase64Url(new Uint8Array(sigBuf));
}

/**
 * Verify an Ed25519 signature against a public key.
 * `signature` must be the base64url string returned by `sign()`.
 */
export async function verify(
  data: Uint8Array,
  signature: string,
  publicKey: CryptoKey,
): Promise<boolean> {
  const sigBytes = base64UrlToUint8Array(signature);
  return globalThis.crypto.subtle.verify(
    'Ed25519' as AlgorithmIdentifier,
    publicKey,
    sigBytes as BufferSource,
    data as BufferSource,
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  // Convert to standard base64 then swap chars + strip padding
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUint8Array(b64url: string): Uint8Array {
  // Re-add padding and convert back from url-safe alphabet
  const b64 = b64url
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), '=');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
