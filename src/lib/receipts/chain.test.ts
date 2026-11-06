import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { canonicalJson, sha256hex, buildReceipt, verifyChain } from './chain';
import { generateKeyPair } from './crypto';
import type { Receipt, ReceiptKind } from '@/types/index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_KINDS: ReceiptKind[] = [
  'wayback',
  'wayback-miss',
  'github-meta',
  'github-commits',
  'spec',
  'fork',
];

/** Arbitrary for ReceiptKind values */
const fcKind = fc.constantFrom(...ALL_KINDS);

/** Arbitrary for non-empty URL-like strings (fast-check webUrl can be slow) */
const fcUrl = fc.stringMatching(/^[a-z0-9]{4,40}$/).map((s: string) => `https://${s}.example.com`);

/**
 * Build a chain of receipts from a list of (kind, url) descriptors.
 */
async function buildChain(
  inputs: { kind: ReceiptKind; url: string }[],
  privateKey: CryptoKey,
): Promise<Receipt[]> {
  const chain: Receipt[] = [];
  for (const { kind, url } of inputs) {
    const body = new TextEncoder().encode(url); // deterministic stand-in body
    const prev = chain.length > 0 ? chain[chain.length - 1] : null;
    chain.push(await buildReceipt(prev, kind, url, body, privateKey));
  }
  return chain;
}

/**
 * Return a copy of `obj` with keys in a shuffled order.
 */
function shuffleKeys<T extends Record<string, unknown>>(obj: T): T {
  const keys = Object.keys(obj);
  // Fisher–Yates using the last key as seed (deterministic enough for tests)
  for (let i = keys.length - 1; i > 0; i--) {
    const j = (i * 7 + 3) % (i + 1);
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const shuffled: Record<string, unknown> = {};
  for (const k of keys) shuffled[k] = obj[k];
  return shuffled as T;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let privateKey: CryptoKey;
let publicKey: CryptoKey;

beforeAll(async () => {
  const kp = await generateKeyPair();
  privateKey = kp.privateKey;
  publicKey = kp.publicKey;
});

// ---------------------------------------------------------------------------
// Unit smoke tests
// ---------------------------------------------------------------------------

describe('canonicalJson', () => {
  it('produces valid UTF-8 JSON', () => {
    const bytes = canonicalJson({ b: 2, a: 1 });
    const json = new TextDecoder().decode(bytes);
    expect(JSON.parse(json)).toEqual({ a: 1, b: 2 });
  });

  it('sorts keys lexicographically', () => {
    const bytes = canonicalJson({ z: 'last', a: 'first', m: 'mid' });
    const json = new TextDecoder().decode(bytes);
    expect(json).toBe('{"a":"first","m":"mid","z":"last"}');
  });
});

describe('sha256hex', () => {
  it('returns a 64-char lowercase hex string', async () => {
    const hex = await sha256hex(new TextEncoder().encode('hello'));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', async () => {
    const data = new TextEncoder().encode('gravekeeper');
    expect(await sha256hex(data)).toBe(await sha256hex(data));
  });
});

// ---------------------------------------------------------------------------
// Property 1 — Determinism of canonicalJson
// ---------------------------------------------------------------------------

describe('canonicalJson — property: determinism', () => {
  it('produces the same bytes regardless of original key insertion order', () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.string(),
          b: fc.integer(),
          c: fc.boolean(),
          d: fc.string(),
        }),
        (obj) => {
          const shuffled = shuffleKeys(obj as Record<string, unknown>);
          const canonical1 = canonicalJson(obj as Record<string, unknown>);
          const canonical2 = canonicalJson(shuffled);
          expect(canonical1).toEqual(canonical2);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — Chain integrity (prevHash linkage)
// ---------------------------------------------------------------------------

describe('verifyChain — property: chain integrity', () => {
  it('any chain built by buildChain passes verifyChain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 1, maxLength: 8 },
        ),
        async (inputs) => {
          const chain = await buildChain(inputs, privateKey);
          const result = await verifyChain(chain, publicKey);
          expect(result.valid).toBe(true);
          expect(result.brokenAt).toBeUndefined();
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Hash consistency
// ---------------------------------------------------------------------------

describe('buildReceipt — property: hash consistency', () => {
  it('each receipt\'s hash matches sha256hex(canonicalJson(unsigned fields))', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 1, maxLength: 6 },
        ),
        async (inputs) => {
          const chain = await buildChain(inputs, privateKey);
          for (const r of chain) {
            const { hash: _h, signature: _s, ...unsigned } = r;
            const canonical = canonicalJson(unsigned as Record<string, unknown>);
            const expected = await sha256hex(canonical);
            expect(r.hash).toBe(expected);
          }
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4 — Signature round-trip
// ---------------------------------------------------------------------------

describe('verifyChain — property: signature round-trip', () => {
  it('a freshly built chain always passes signature verification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 1, maxLength: 5 },
        ),
        async (inputs) => {
          // Use a fresh key pair so each run is independent
          const kp = await generateKeyPair();
          const chain = await buildChain(inputs, kp.privateKey);
          const result = await verifyChain(chain, kp.publicKey);
          expect(result.valid).toBe(true);
        },
      ),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5 — Tamper detection
// ---------------------------------------------------------------------------

describe('verifyChain — property: tamper detection', () => {
  it('mutating a field on any receipt causes verifyChain to return false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 2, maxLength: 6 },
        ),
        fc.nat(),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (inputs, idxSeed, mutation) => {
          const chain = await buildChain(inputs, privateKey);
          const idx = idxSeed % chain.length;

          // Mutate the `url` field of receipt at `idx`
          const tampered: Receipt[] = chain.map((r, i) =>
            i === idx ? { ...r, url: r.url + mutation } : r,
          );

          const result = await verifyChain(tampered, publicKey);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('mutating hash directly causes verifyChain to return false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 1, maxLength: 4 },
        ),
        fc.nat(),
        async (inputs, idxSeed) => {
          const chain = await buildChain(inputs, privateKey);
          const idx = idxSeed % chain.length;

          const tampered: Receipt[] = chain.map((r, i) =>
            i === idx ? { ...r, hash: '0'.repeat(64) } : r,
          );

          const result = await verifyChain(tampered, publicKey);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 15 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6 — Seq monotonicity
// ---------------------------------------------------------------------------

describe('buildReceipt — property: seq monotonicity', () => {
  it('receipts[i].seq === i for all i in a valid chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 1, maxLength: 10 },
        ),
        async (inputs) => {
          const chain = await buildChain(inputs, privateKey);
          chain.forEach((r, i) => {
            expect(r.seq).toBe(i);
          });
        },
      ),
      { numRuns: 20 },
    );
  });

  it('a chain with mismatched seq fails verifyChain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({ kind: fcKind, url: fcUrl }),
          { minLength: 2, maxLength: 6 },
        ),
        fc.nat(),
        async (inputs, idxSeed) => {
          const chain = await buildChain(inputs, privateKey);
          const idx = idxSeed % chain.length;

          // Force a wrong seq value
          const tampered: Receipt[] = chain.map((r, i) =>
            i === idx ? { ...r, seq: r.seq + 1000 } : r,
          );

          const result = await verifyChain(tampered, publicKey);
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: 15 },
    );
  });
});


// ---------------------------------------------------------------------------
// Extra — canonical JSON UTF-8 round-trip / parse stability
// ---------------------------------------------------------------------------

describe('canonicalJson — property: UTF-8 round-trip', () => {
  it('decoding then JSON.parse yields the same values with sorted key order', () => {
    fc.assert(
      fc.property(
        fc.record({
          seq: fc.nat({ max: 20 }),
          kind: fcKind,
          url: fcUrl,
          fetchedAt: fc.constant('2026-11-06T00:00:00.000Z'),
          contentSha256: fc.stringMatching(/^[a-f0-9]{64}$/),
          prevHash: fc.option(fc.stringMatching(/^[a-f0-9]{64}$/), { nil: null }),
        }),
        (obj) => {
          const bytes = canonicalJson(obj as Record<string, unknown>);
          const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<
            string,
            unknown
          >;
          // Values match
          expect(parsed).toEqual(obj);
          // Keys are sorted
          expect(Object.keys(parsed)).toEqual(Object.keys(parsed).sort());
          // Second canonicalisation is identical
          expect(Array.from(canonicalJson(parsed))).toEqual(Array.from(bytes));
        },
      ),
      { numRuns: 50 },
    );
  });
});

