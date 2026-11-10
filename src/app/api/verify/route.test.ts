import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { buildReceipt } from '@/lib/receipts/chain';
import { exportPublicKey, generateKeyPair } from '@/lib/receipts/crypto';
import { buildReceiptExport } from '@/lib/receipts/export';

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/verify', () => {
  it('returns 400 for a body that is not an export', async () => {
    const res = await POST(jsonRequest({ nope: true }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe('parse');
    expect(body.code).toBe('PARSE_ERROR');
  });

  it('verifies a signed export and rejects a tampered one', async () => {
    const { privateKey, publicKey } = await generateKeyPair();
    const receipt = await buildReceipt(
      null,
      'fixture',
      'https://fixtures.gravekeeper.dev/lantern-hill/',
      new TextEncoder().encode('<html>before</html>'),
      privateKey,
    );
    const exported = buildReceiptExport({
      publicKey: await exportPublicKey(publicKey),
      receipts: [receipt],
      beforeHtml: '<html>before</html>',
    });

    const ok = await POST(jsonRequest(exported));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ valid: true, artifacts: { before: true, after: null } });

    const broken = await POST(jsonRequest({
      ...exported,
      receipts: [{ ...receipt, hash: `${'ab'.repeat(32)}` }],
    }));
    expect(broken.status).toBe(200);
    const body = await broken.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe('chain');
  });
});
