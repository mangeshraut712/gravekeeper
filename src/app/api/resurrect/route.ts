/**
 * POST /api/resurrect
 *
 * Orchestrates Wayback + (optional) GitHub lookups, builds an Ed25519
 * hash-chained receipt list, and returns a ResurrectResponse.
 *
 * Stateless: a fresh key pair is generated per request. Never throws to the
 * client — validation errors are 400; unexpected crypto failures are 500;
 * upstream misses become partial 200 responses with receipts.
 */

import { NextRequest } from 'next/server';
import type { Receipt, ResurrectResponse, RevivalSpec } from '@/types/index';
import { generateKeyPair, exportPublicKey } from '@/lib/receipts/crypto';
import { buildReceipt } from '@/lib/receipts/chain';
import { fetchWaybackSnapshot } from '@/lib/wayback/client';
import {
  parseGitHubUrl,
  fetchRepoMeta,
  fetchCommits,
} from '@/lib/github/client';
import { generateRevivalSpec } from '@/lib/spec/generator';
import { isFixtureUrl, loadLanternHill } from '@/lib/restore/fixture';
import { restoreDeadHtml } from '@/lib/restore/html';

function utf8Bytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(
    typeof value === 'string' ? value : JSON.stringify(value),
  );
}

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

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as { url?: unknown }).url !== 'string'
  ) {
    return Response.json(
      { error: 'Body must include a string "url" field.', code: 'PARSE_ERROR' },
      { status: 400 },
    );
  }

  const url = (body as { url: string }).url.trim();
  if (!url) {
    return Response.json(
      { error: 'url must be a non-empty string.', code: 'PARSE_ERROR' },
      { status: 400 },
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

  if (isFixtureUrl(url)) {
    const fixture = loadLanternHill();
    const restored = restoreDeadHtml(fixture.beforeHtml, { fixtureLabel: 'Lantern Hill' });
    const beforeReceipt = await buildReceipt(
      null,
      'fixture',
      fixture.url,
      utf8Bytes(fixture.beforeHtml),
      privateKey,
    );
    const afterReceipt = await buildReceipt(
      beforeReceipt,
      'restoration',
      `${fixture.url}#restored`,
      utf8Bytes(restored.html),
      privateKey,
    );
    const response: ResurrectResponse = {
      receipts: [beforeReceipt, afterReceipt],
      spec: null,
      wayback: null,
      github: null,
      publicKey: publicKeyB64,
      restoration: {
        fixtureId: fixture.id,
        title: restored.title,
        license: fixture.license,
        disclosure: fixture.disclosure,
        beforeHtml: fixture.beforeHtml,
        afterHtml: restored.html,
        changes: restored.changes,
        beforePath: fixture.beforePath,
        afterPath: fixture.afterPath,
      },
    };
    return Response.json(response, { status: 200 });
  }

  const receipts: Receipt[] = [];
  let prev: Receipt | null = null;

  // --- Wayback ---
  const waybackResult = await fetchWaybackSnapshot(url);
  let wayback: ResurrectResponse['wayback'] = null;

  if (waybackResult.ok) {
    wayback = waybackResult.data;
    const receipt = await buildReceipt(
      prev,
      'wayback',
      url,
      utf8Bytes(waybackResult.data),
      privateKey,
    );
    receipts.push(receipt);
    prev = receipt;
  } else {
    const receipt = await buildReceipt(
      prev,
      'wayback-miss',
      url,
      utf8Bytes({ error: waybackResult.error, code: waybackResult.code }),
      privateKey,
    );
    receipts.push(receipt);
    prev = receipt;
  }

  // --- GitHub (optional) ---
  const parsed = parseGitHubUrl(url);
  let github: ResurrectResponse['github'] = null;
  let spec: RevivalSpec | null = null;

  if (parsed) {
    const metaResult = await fetchRepoMeta(parsed.owner, parsed.repo);
    if (metaResult.ok) {
      const metaUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      const metaReceipt = await buildReceipt(
        prev,
        'github-meta',
        metaUrl,
        utf8Bytes(metaResult.data),
        privateKey,
      );
      receipts.push(metaReceipt);
      prev = metaReceipt;

      const commitsResult = await fetchCommits(parsed.owner, parsed.repo);
      if (commitsResult.ok) {
        const commitsUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?per_page=20`;
        const commitsReceipt = await buildReceipt(
          prev,
          'github-commits',
          commitsUrl,
          utf8Bytes(commitsResult.data),
          privateKey,
        );
        receipts.push(commitsReceipt);
        prev = commitsReceipt;

        github = { meta: metaResult.data, commits: commitsResult.data };
        spec = generateRevivalSpec(metaResult.data, commitsResult.data);

        const specReceipt = await buildReceipt(
          prev,
          'spec',
          url,
          utf8Bytes(spec),
          privateKey,
        );
        receipts.push(specReceipt);
        prev = specReceipt;
      } else {
        // Meta succeeded but commits failed — still expose meta alone.
        github = { meta: metaResult.data, commits: [] };
        const missReceipt = await buildReceipt(
          prev,
          'github-commits',
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits`,
          utf8Bytes({ error: commitsResult.error, code: commitsResult.code }),
          privateKey,
        );
        receipts.push(missReceipt);
        prev = missReceipt;
      }
    } else {
      const missReceipt = await buildReceipt(
        prev,
        'github-meta',
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
        utf8Bytes({ error: metaResult.error, code: metaResult.code }),
        privateKey,
      );
      receipts.push(missReceipt);
      prev = missReceipt;
    }
  }

  const response: ResurrectResponse = {
    receipts,
    spec,
    wayback,
    github,
    publicKey: publicKeyB64,
    restoration: null,
  };

  return Response.json(response, { status: 200 });
}
