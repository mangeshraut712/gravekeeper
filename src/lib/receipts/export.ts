/**
 * Portable receipt export and offline verification.
 *
 * A third party needs the JSON file and this checker. Verification uses the
 * embedded public key and WebCrypto. It does not call Gravekeeper.
 */

import type { Receipt, ReceiptKind } from '@/types/index';
import { sha256hex, verifyChain } from './chain';
import { importPublicKey } from './crypto';

export const RECEIPT_EXPORT_KIND = 'receipt-export';
export const RECEIPT_EXPORT_VERSION = 1;

export type VerifyFailureReason = 'parse' | 'chain' | 'artifact-hash' | 'public-key';

export type ReceiptExportV1 = {
  gravekeeper: typeof RECEIPT_EXPORT_KIND;
  version: typeof RECEIPT_EXPORT_VERSION;
  publicKey: string;
  receipts: Receipt[];
  artifacts?: {
    beforeHtml?: string;
    afterHtml?: string;
  };
};

export type VerifyExportResult = {
  valid: boolean;
  brokenAt?: number;
  reason?: VerifyFailureReason;
  artifacts?: {
    before: boolean | null;
    after: boolean | null;
  };
};

export function buildReceiptExport(input: {
  publicKey: string;
  receipts: Receipt[];
  beforeHtml?: string;
  afterHtml?: string;
}): ReceiptExportV1 {
  const artifacts: ReceiptExportV1['artifacts'] = {};
  if (input.beforeHtml !== undefined) artifacts.beforeHtml = input.beforeHtml;
  if (input.afterHtml !== undefined) artifacts.afterHtml = input.afterHtml;
  return {
    gravekeeper: RECEIPT_EXPORT_KIND,
    version: RECEIPT_EXPORT_VERSION,
    publicKey: input.publicKey,
    receipts: input.receipts,
    ...(input.beforeHtml !== undefined || input.afterHtml !== undefined ? { artifacts } : {}),
  };
}

export async function verifyReceiptExport(input: unknown): Promise<VerifyExportResult> {
  const parsed = parseExport(input);
  if (!parsed) return { valid: false, reason: 'parse' };

  let publicKey: CryptoKey;
  try {
    publicKey = await importPublicKey(parsed.publicKey);
  } catch {
    return { valid: false, reason: 'public-key' };
  }

  const chain = await verifyChain(parsed.receipts, publicKey);
  const artifacts = await checkArtifacts(parsed);

  if (!chain.valid) {
    return {
      valid: false,
      brokenAt: chain.brokenAt,
      reason: 'chain',
      ...(artifacts ? { artifacts } : {}),
    };
  }

  if (artifacts && (artifacts.before === false || artifacts.after === false)) {
    return { valid: false, reason: 'artifact-hash', artifacts };
  }

  return { valid: true, ...(artifacts ? { artifacts } : {}) };
}

async function checkArtifacts(exported: ReceiptExportV1): Promise<VerifyExportResult['artifacts'] | undefined> {
  const beforeHtml = exported.artifacts?.beforeHtml;
  const afterHtml = exported.artifacts?.afterHtml;
  if (beforeHtml === undefined && afterHtml === undefined) return undefined;

  const before = beforeHtml === undefined
    ? null
    : await artifactMatches(exported.receipts, 'fixture', beforeHtml);
  const after = afterHtml === undefined
    ? null
    : await artifactMatches(exported.receipts, 'restoration', afterHtml);
  return { before, after };
}

async function artifactMatches(
  receipts: Receipt[],
  kind: ReceiptKind,
  html: string,
): Promise<boolean> {
  const receipt = receipts.find((item) => item.kind === kind);
  if (!receipt) return false;
  const digest = await sha256hex(new TextEncoder().encode(html));
  return digest === receipt.contentSha256;
}

function parseExport(input: unknown): ReceiptExportV1 | null {
  if (typeof input !== 'object' || input === null) return null;
  const record = input as Record<string, unknown>;
  if (record.gravekeeper !== RECEIPT_EXPORT_KIND) return null;
  if (record.version !== RECEIPT_EXPORT_VERSION) return null;
  if (typeof record.publicKey !== 'string' || record.publicKey.length === 0) return null;
  if (!Array.isArray(record.receipts) || !record.receipts.every(isReceipt)) return null;

  let artifacts: ReceiptExportV1['artifacts'];
  if (record.artifacts !== undefined) {
    if (typeof record.artifacts !== 'object' || record.artifacts === null) return null;
    const raw = record.artifacts as Record<string, unknown>;
    if (raw.beforeHtml !== undefined && typeof raw.beforeHtml !== 'string') return null;
    if (raw.afterHtml !== undefined && typeof raw.afterHtml !== 'string') return null;
    artifacts = {};
    if (typeof raw.beforeHtml === 'string') artifacts.beforeHtml = raw.beforeHtml;
    if (typeof raw.afterHtml === 'string') artifacts.afterHtml = raw.afterHtml;
  }

  return {
    gravekeeper: RECEIPT_EXPORT_KIND,
    version: RECEIPT_EXPORT_VERSION,
    publicKey: record.publicKey,
    receipts: record.receipts,
    ...(artifacts ? { artifacts } : {}),
  };
}

function isReceipt(value: unknown): value is Receipt {
  if (typeof value !== 'object' || value === null) return false;
  const receipt = value as Record<string, unknown>;
  return (
    typeof receipt.seq === 'number' &&
    (receipt.prevHash === null || typeof receipt.prevHash === 'string') &&
    typeof receipt.hash === 'string' &&
    typeof receipt.kind === 'string' &&
    typeof receipt.url === 'string' &&
    typeof receipt.fetchedAt === 'string' &&
    typeof receipt.contentSha256 === 'string' &&
    typeof receipt.signature === 'string'
  );
}
