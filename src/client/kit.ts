import type { ResurrectResponse } from "@/types";
import { sha256hex } from "../lib/receipts/chain.ts";
import { buildIssueBody, buildRevivalMarkdown } from "../lib/revival/markdown.ts";
import { exportProof, verifyProof } from "./proof.ts";

export type RevivalKitResult =
  | { ok: true; markdown: string; issueBody: string; proofSha256: string }
  | { ok: false; reason: "unverified" | "no-plan" };

/**
 * Build the revival kit only from a lookup that passes verifyProof(). The proof hash is
 * over the same bytes "Download proof" writes. Never throws; no network.
 */
export async function prepareRevivalKit(
  result: ResurrectResponse,
  url: string,
): Promise<RevivalKitResult> {
  try {
    if (!(await verifyProof(result, url))) return { ok: false, reason: "unverified" };
    if (!result.spec || !result.github) return { ok: false, reason: "no-plan" };
    const proofSha256 = await sha256hex(new TextEncoder().encode(exportProof(result, url)));
    const input = { result, resource: url, proofSha256 };
    return {
      ok: true,
      markdown: buildRevivalMarkdown(input),
      issueBody: buildIssueBody(input),
      proofSha256,
    };
  } catch {
    return { ok: false, reason: "unverified" };
  }
}
