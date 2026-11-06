import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildReceipt } from './chain';
import { generateKeyPair, exportPublicKey } from './crypto';
import { buildReceiptExport, verifyReceiptExport } from './export';
import type { Receipt, ReceiptKind } from '@/types/index';

async function signedChain(bodies: { kind: ReceiptKind; url: string; body: string }[]): Promise<{
  receipts: Receipt[];
  publicKey: string;
}> {
  const { privateKey, publicKey } = await generateKeyPair();
  const receipts: Receipt[] = [];
  for (const item of bodies) {
    const prev = receipts.length > 0 ? receipts[receipts.length - 1] : null;
    receipts.push(
      await buildReceipt(prev, item.kind, item.url, new TextEncoder().encode(item.body), privateKey),
    );
  }
  return { receipts, publicKey: await exportPublicKey(publicKey) };
}

describe('verifyReceiptExport', () => {
  it('accepts a chain built by Gravekeeper and checks artifact hashes', async () => {
    const beforeHtml = '<html><body>before</body></html>';
    const afterHtml = '<!DOCTYPE html><html><body>after</body></html>';
    const signed = await signedChain([
      { kind: 'fixture', url: 'https://fixtures.gravekeeper.dev/lantern-hill/', body: beforeHtml },
      { kind: 'restoration', url: 'https://fixtures.gravekeeper.dev/lantern-hill/#restored', body: afterHtml },
    ]);
    const exported = buildReceiptExport({ ...signed, beforeHtml, afterHtml });
    const result = await verifyReceiptExport(exported);
    expect(result.valid).toBe(true);
    expect(result.artifacts).toEqual({ before: true, after: true });
  });

  it('rejects a tampered receipt', async () => {
    const signed = await signedChain([
      { kind: 'wayback', url: 'https://example.com/dead', body: 'snapshot' },
    ]);
    const exported = buildReceiptExport(signed);
    exported.receipts[0] = { ...exported.receipts[0], url: 'https://example.com/changed' };
    const result = await verifyReceiptExport(exported);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('chain');
    expect(result.brokenAt).toBe(0);
  });

  it('rejects an artifact whose bytes no longer match the receipt', async () => {
    const beforeHtml = '<html>before</html>';
    const signed = await signedChain([
      { kind: 'fixture', url: 'https://fixtures.gravekeeper.dev/lantern-hill/', body: beforeHtml },
    ]);
    const exported = buildReceiptExport({ ...signed, beforeHtml: `${beforeHtml} ` });
    const result = await verifyReceiptExport(exported);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('artifact-hash');
    expect(result.artifacts?.before).toBe(false);
  });

  it('rejects a file that is not an export', async () => {
    const result = await verifyReceiptExport({ hello: 'world' });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('parse');
  });

  it('property: any chain this module signs verifies until a field changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 4 }),
        async (bodies) => {
          const signed = await signedChain(
            bodies.map((body, index) => ({
              kind: 'wayback' as const,
              url: `https://example.com/${index}`,
              body,
            })),
          );
          const exported = buildReceiptExport(signed);
          expect((await verifyReceiptExport(exported)).valid).toBe(true);
          const tampered = buildReceiptExport(signed);
          tampered.receipts[0] = { ...tampered.receipts[0], fetchedAt: '1999-01-01T00:00:00.000Z' };
          expect((await verifyReceiptExport(tampered)).valid).toBe(false);
        },
      ),
      { numRuns: 8 },
    );
  });
});
