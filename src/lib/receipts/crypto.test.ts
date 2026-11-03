import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { generateKeyPair, exportPublicKey, sign, verify } from './crypto';

describe('crypto', () => {
  // One shared key pair for the deterministic property tests that don't
  // need per-test key generation — saves time on large-N runs.
  let sharedPrivateKey: CryptoKey;
  let sharedPublicKey: CryptoKey;

  beforeAll(async () => {
    const kp = await generateKeyPair();
    sharedPrivateKey = kp.privateKey;
    sharedPublicKey = kp.publicKey;
  });

  // ---------------------------------------------------------------------------
  // Smoke tests
  // ---------------------------------------------------------------------------

  it('generateKeyPair returns CryptoKey objects with correct usages', async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    expect(privateKey.type).toBe('private');
    expect(publicKey.type).toBe('public');
    expect(privateKey.usages).toContain('sign');
    expect(publicKey.usages).toContain('verify');
  });

  it('exportPublicKey returns a non-empty base64url string (no padding)', async () => {
    const { publicKey } = await generateKeyPair();
    const exported = await exportPublicKey(publicKey);
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);
    // base64url must not contain +, /, or =
    expect(exported).not.toMatch(/[+/=]/);
  });

  // ---------------------------------------------------------------------------
  // Property: sign → verify round-trip holds for arbitrary byte arrays
  // ---------------------------------------------------------------------------

  it('sign/verify round-trip holds for arbitrary byte arrays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 1024 }),
        async (data) => {
          const sig = await sign(data, sharedPrivateKey);
          const valid = await verify(data, sig, sharedPublicKey);
          expect(valid).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property: sign round-trip works with a fresh key pair per run
  // ---------------------------------------------------------------------------

  it('sign/verify round-trip holds with independent key pairs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        async (data) => {
          const { privateKey, publicKey } = await generateKeyPair();
          const sig = await sign(data, privateKey);
          const valid = await verify(data, sig, publicKey);
          expect(valid).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property: tampered data fails verification
  // ---------------------------------------------------------------------------

  it('verification fails when the signed data is mutated', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Need at least 1 byte so there is something to flip
        fc.uint8Array({ minLength: 1, maxLength: 512 }),
        fc.integer({ min: 1, max: 255 }),
        async (data, flipByte) => {
          const sig = await sign(data, sharedPrivateKey);

          // Flip bits in the first byte, ensuring at least one bit differs
          const tampered = new Uint8Array(data);
          tampered[0] = tampered[0] ^ flipByte;

          const valid = await verify(tampered, sig, sharedPublicKey);
          expect(valid).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property: a signature produced with one key does not verify with another
  // ---------------------------------------------------------------------------

  it('signature from one key pair does not verify against a different public key', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 256 }),
        async (data) => {
          const { privateKey: pk1 } = await generateKeyPair();
          const { publicKey: pk2 } = await generateKeyPair();

          const sig = await sign(data, pk1);
          const valid = await verify(data, sig, pk2);
          expect(valid).toBe(false);
        },
      ),
      { numRuns: 10 },
    );
  });
});
