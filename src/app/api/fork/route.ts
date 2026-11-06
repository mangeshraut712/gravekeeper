/**
 * POST /api/fork
 *
 * Creates a GitHub fork for the authenticated user and records a Receipt of
 * kind "fork". Requires GITHUB_TOKEN; returns 503 when it is absent.
 */

import { NextRequest } from 'next/server';
import type { Receipt } from '@/types/index';
import { generateKeyPair, exportPublicKey } from '@/lib/receipts/crypto';
import { buildReceipt } from '@/lib/receipts/chain';
import { createFork } from '@/lib/github/client';

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Request body must be valid JSON.', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json(
      { error: 'Body must be a JSON object.', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }

  const owner = (body as { owner?: unknown }).owner;
  const repo = (body as { repo?: unknown }).repo;

  if (typeof owner !== 'string' || !owner.trim()) {
    return Response.json(
      { error: 'Body must include a non-empty string "owner".', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }
  if (typeof repo !== 'string' || !repo.trim()) {
    return Response.json(
      { error: 'Body must include a non-empty string "repo".', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }

  if (!process.env['GITHUB_TOKEN']) {
    return Response.json(
      {
        error: 'GITHUB_TOKEN is not configured. Fork creation is unavailable.',
        code: 'FORK_FAILED',
      },
      { status: 503 },
    );
  }

  const forkResult = await createFork(owner.trim(), repo.trim());
  if (!forkResult.ok) {
    const status =
      forkResult.code === 'GITHUB_NOT_FOUND'
        ? 404
        : forkResult.code === 'GITHUB_RATE_LIMIT'
          ? 429
          : forkResult.code === 'FORK_FAILED'
            ? 502
            : 502;
    return Response.json(
      { error: forkResult.error, code: forkResult.code },
      { status },
    );
  }

  let privateKey: CryptoKey;
  let publicKey: CryptoKey;
  try {
    ({ privateKey, publicKey } = await generateKeyPair());
  } catch (err) {
    return Response.json(
      {
        error: err instanceof Error ? err.message : 'Key generation failed',
        code: 'CRYPTO_ERROR',
      },
      { status: 500 },
    );
  }

  const publicKeyB64 = await exportPublicKey(publicKey);
  const forkApiUrl = `https://api.github.com/repos/${owner.trim()}/${repo.trim()}/forks`;
  const receipt: Receipt = await buildReceipt(
    null,
    'fork',
    forkApiUrl,
    new TextEncoder().encode(forkResult.data.rawBody),
    privateKey,
  );

  return Response.json(
    {
      forkUrl: forkResult.data.forkUrl,
      receipt,
      publicKey: publicKeyB64,
    },
    { status: 200 },
  );
}
