/**
 * Unit tests for POST /api/fork with mocked fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { verifyChain } from '@/lib/receipts/chain';

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/fork', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function importPublicKey(b64url: string): Promise<CryptoKey> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '=',
  );
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey('raw', bytes, { name: 'Ed25519' }, true, [
    'verify',
  ]);
}

describe('GET /api/fork', () => {
  const ORIGINAL_TOKEN = process.env['GITHUB_TOKEN'];

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env['GITHUB_TOKEN'];
    else process.env['GITHUB_TOKEN'] = ORIGINAL_TOKEN;
  });

  it('reports whether a token is configured without returning it', async () => {
    delete process.env['GITHUB_TOKEN'];
    const missing = await GET(new NextRequest('http://localhost/api/fork'));
    expect(await missing.json()).toEqual({ enabled: false });

    process.env['GITHUB_TOKEN'] = 'secret-token';
    const present = await GET(new NextRequest('http://localhost/api/fork'));
    const body = await present.json();
    expect(body).toEqual({ enabled: true });
    expect(JSON.stringify(body)).not.toContain('secret-token');
  });
});

describe('POST /api/fork', () => {
  const ORIGINAL_TOKEN = process.env['GITHUB_TOKEN'];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env['GITHUB_TOKEN'];
    } else {
      process.env['GITHUB_TOKEN'] = ORIGINAL_TOKEN;
    }
    vi.restoreAllMocks();
  });

  it('returns 400 when owner/repo missing', async () => {
    process.env['GITHUB_TOKEN'] = 'tok';
    const res = await POST(jsonRequest({ owner: 'a' }));
    expect(res.status).toBe(400);
  });

  it('returns 503 when GITHUB_TOKEN is unset', async () => {
    delete process.env['GITHUB_TOKEN'];
    const res = await POST(jsonRequest({ owner: 'a', repo: 'b' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe('FORK_FAILED');
  });

  it('returns forkUrl and a verifiable fork receipt on success', async () => {
    process.env['GITHUB_TOKEN'] = 'tok';
    const forkBody = { html_url: 'https://github.com/me/gravekeeper' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: async () => JSON.stringify(forkBody),
      }),
    );

    const res = await POST(jsonRequest({ owner: 'ghost', repo: 'gravekeeper' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forkUrl).toBe('https://github.com/me/gravekeeper');
    expect(body.receipt.kind).toBe('fork');

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain([body.receipt], pk);
    expect(verified.valid).toBe(true);
  });

  it('surfaces FORK_FAILED when GitHub rejects the fork', async () => {
    process.env['GITHUB_TOKEN'] = 'tok';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"message":"bad request"}',
      }),
    );
    const res = await POST(jsonRequest({ owner: 'ghost', repo: 'gravekeeper' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('FORK_FAILED');
  });
});
