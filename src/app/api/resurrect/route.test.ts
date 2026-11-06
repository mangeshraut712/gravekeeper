/**
 * Integration-style unit tests for POST /api/resurrect.
 * All upstream HTTP is mocked via vi.stubGlobal('fetch').
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { verifyChain } from '@/lib/receipts/chain';
import fc from 'fast-check';

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/resurrect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function waybackOk(url: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url,
      archived_snapshots: {
        closest: {
          status: '200',
          available: true,
          url: `https://web.archive.org/web/20231015120000/${url}`,
          timestamp: '20231015120000',
        },
      },
    }),
  };
}

function waybackMiss(url: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url,
      archived_snapshots: {},
    }),
  };
}

function githubMetaOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      name: 'gravekeeper',
      full_name: 'ghost/gravekeeper',
      owner: { login: 'ghost' },
      description: 'haunted',
      stargazers_count: 3,
      forks_count: 1,
      open_issues_count: 0,
      license: { spdx_id: 'MIT', name: 'MIT' },
      default_branch: 'main',
      pushed_at: '2020-01-01T00:00:00Z',
      archived: true,
      language: 'TypeScript',
    }),
  };
}

function githubCommitsOk() {
  return {
    ok: true,
    status: 200,
    json: async () => [
      {
        sha: 'abc123',
        commit: {
          message: 'initial commit\n\nbody',
          author: { date: '2020-01-01T00:00:00Z', name: 'Ghost' },
        },
      },
    ],
  };
}

/** Import raw public key bytes from base64url for verifyChain. */
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

describe('POST /api/resurrect', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 when url is missing', async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('PARSE_ERROR');
  });

  it('returns 400 when url is empty', async () => {
    const res = await POST(jsonRequest({ url: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns wayback-only response for a non-GitHub URL', async () => {
    const url = 'https://example.com/dead';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(waybackOk(url)),
    );

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.github).toBeNull();
    expect(body.spec).toBeNull();
    expect(body.wayback?.available).toBe(true);
    expect(body.receipts[0].kind).toBe('wayback');
    expect(typeof body.publicKey).toBe('string');

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain(body.receipts, pk);
    expect(verified.valid).toBe(true);
  });

  it('records wayback-miss and continues when no snapshot exists', async () => {
    const url = 'https://example.com/never-archived';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(waybackMiss(url)));

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wayback).toBeNull();
    expect(body.receipts[0].kind).toBe('wayback-miss');
  });

  it('builds a full GitHub resurrection chain with a valid receipt chain', async () => {
    const url = 'https://github.com/ghost/gravekeeper';
    const fetchMock = vi.fn().mockImplementation(async (req: string | URL) => {
      const href = String(req);
      if (href.includes('archive.org')) return waybackOk(url);
      if (href.includes('/commits')) return githubCommitsOk();
      if (href.includes('/repos/')) return githubMetaOk();
      throw new Error(`unexpected fetch: ${href}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.github?.meta.fullName).toBe('ghost/gravekeeper');
    expect(body.spec?.revivalSteps.length).toBeGreaterThanOrEqual(3);
    expect(body.receipts.map((r: { kind: string }) => r.kind)).toEqual([
      'wayback',
      'github-meta',
      'github-commits',
      'spec',
    ]);

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain(body.receipts, pk);
    expect(verified.valid).toBe(true);
  });

  it('property: successful GitHub resurrect always yields a verifiable receipt chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/),
        async (owner, repo) => {
          const url = `https://github.com/${owner}/${repo}`;
          vi.stubGlobal(
            'fetch',
            vi.fn().mockImplementation(async (req: string | URL) => {
              const href = String(req);
              if (href.includes('archive.org')) return waybackOk(url);
              if (href.includes('/commits')) return githubCommitsOk();
              if (href.includes('/repos/')) {
                const base = await githubMetaOk();
                const json = await base.json();
                return {
                  ...base,
                  json: async () => ({
                    ...json,
                    name: repo,
                    full_name: `${owner}/${repo}`,
                    owner: { login: owner },
                  }),
                };
              }
              throw new Error(`unexpected fetch: ${href}`);
            }),
          );

          const res = await POST(jsonRequest({ url }));
          expect(res.status).toBe(200);
          const body = await res.json();
          const pk = await importPublicKey(body.publicKey);
          const verified = await verifyChain(body.receipts, pk);
          expect(verified.valid).toBe(true);
          expect(body.receipts.length).toBeGreaterThanOrEqual(4);
        },
      ),
      { numRuns: 15 },
    );
  });
});
