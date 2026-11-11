import { verifyProof } from "@/client/proof";
import { verifyReceiptExport } from "@/lib/receipts/export";
import type { ResurrectResponse } from "@/types";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export type ProofFormat = "gravekeeper-proof-v1" | "receipt-export";

export type ReceiptRow = {
  seq: number;
  kind: string;
  url: string;
  fetchedAt: string;
  hash: string;
  contentSha256: string;
};

export type ProofErrorCode =
  | "too-large"
  | "invalid-json"
  | "not-object"
  | "unknown-format"
  | "missing-fields";

export type ProofReport =
  | { status: "error"; code: ProofErrorCode; message: string }
  | {
      status: "valid" | "invalid";
      format: ProofFormat;
      receipts: ReceiptRow[];
      message: string;
    };

const fail = (code: ProofErrorCode, message: string): ProofReport => ({
  status: "error",
  code,
  message,
});

/** Display-only projection: copies only primitives of the expected type. */
function rows(value: unknown): ReceiptRow[] {
  if (!Array.isArray(value)) return [];
  const s = (v: unknown) => (typeof v === "string" ? v : "");
  return value.flatMap((item, index) =>
    typeof item === "object" && item !== null
      ? [
          {
            seq:
              typeof (item as { seq?: unknown }).seq === "number"
                ? (item as { seq: number }).seq
                : index,
            kind: s((item as { kind?: unknown }).kind),
            url: s((item as { url?: unknown }).url),
            fetchedAt: s((item as { fetchedAt?: unknown }).fetchedAt),
            hash: s((item as { hash?: unknown }).hash),
            contentSha256: s((item as { contentSha256?: unknown }).contentSha256),
          },
        ]
      : [],
  );
}

/**
 * Parses and verifies a proof file entirely in memory. No network access.
 * Valid means internally consistent, nothing more.
 */
export async function analyzeProofText(text: string): Promise<ProofReport> {
  if (new TextEncoder().encode(text).length > MAX_PROOF_BYTES)
    return fail("too-large", "This file is larger than 5 MB. Gravekeeper proofs are much smaller.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return fail("invalid-json", "This is not readable JSON. Choose the file you downloaded from Gravekeeper.");
  }
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return fail("not-object", "The JSON must be an object with a format field, not a list or a bare value.");
  const record = data as Record<string, unknown>;

  if (record.format === "gravekeeper-proof-v1") {
    if (
      typeof record.publicKey !== "string" ||
      !record.publicKey ||
      !Array.isArray(record.receipts) ||
      !record.receipts.length ||
      !Array.isArray(record.evidence)
    )
      return fail("missing-fields", "A gravekeeper-proof-v1 file needs publicKey, receipts and evidence.");
    const ok = await verifyProof(
      record as unknown as ResurrectResponse,
      typeof record.resource === "string" ? record.resource : undefined,
    );
    return {
      status: ok ? "valid" : "invalid",
      format: "gravekeeper-proof-v1",
      receipts: rows(record.receipts),
      message: ok
        ? "Signatures, hash links and the displayed result data are consistent with each other."
        : "Verification failed. The file was changed, is incomplete, or this browser cannot verify Ed25519 signatures.",
    };
  }

  if (record.gravekeeper === "receipt-export") {
    if (
      typeof record.publicKey !== "string" ||
      !record.publicKey ||
      !Array.isArray(record.receipts) ||
      !record.receipts.length
    )
      return fail("missing-fields", "A receipt-export file needs publicKey and a non-empty receipts list.");
    const result = await verifyReceiptExport(record).catch(() => ({ valid: false as const }));
    const ok = result.valid;
    const at = "brokenAt" in result && typeof result.brokenAt === "number" ? ` The first broken receipt is number ${result.brokenAt + 1}.` : "";
    return {
      status: ok ? "valid" : "invalid",
      format: "receipt-export",
      receipts: rows(record.receipts),
      message: ok
        ? "Signatures, hash links and any included HTML artifacts match the signed receipts."
        : `Verification failed.${at} The file was changed, is incomplete, or this browser cannot verify Ed25519 signatures.`,
    };
  }

  return fail(
    "unknown-format",
    'Unrecognised file. Expected "format": "gravekeeper-proof-v1" or "gravekeeper": "receipt-export".',
  );
}
