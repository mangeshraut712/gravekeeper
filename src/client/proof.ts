import type { ResurrectResponse } from "@/types";
import { sha256hex, verifyChain } from "../lib/receipts/chain.ts";
import {
  buildAutopsy,
  isFailureBody,
  isManifestEvidence,
} from "../lib/deps/autopsy.ts";

/** Crypto-only code is browser-safe and does not include a GitHub client or token. */
export async function verifyProof(
  result: ResurrectResponse,
  expectedResource?: string,
): Promise<boolean> {
  try {
    if (
      !Array.isArray(result.receipts) ||
      !result.receipts.length ||
      !Array.isArray(result.evidence) ||
      result.evidence.length !== result.receipts.length
    )
      return false;
    if (
      expectedResource !== undefined &&
      result.receipts[0].url !== expectedResource
    )
      return false;
    const encoded = result.publicKey.replace(/-/g, "+").replace(/_/g, "/");
    const raw = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", raw, "Ed25519", false, [
      "verify",
    ]);
    if (!(await verifyChain(result.receipts, key)).valid) return false;
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const isFailure = isFailureBody;
    const seen = new Set<string>();
    let manifestBody: unknown;
    let registryBody: unknown = null;
    for (const [index, receipt] of result.receipts.entries()) {
      const evidence = result.evidence[index];
      if (evidence.receiptSeq !== index || seen.has(receipt.kind)) return false;
      seen.add(receipt.kind);
      if (
        (await sha256hex(
          new TextEncoder().encode(JSON.stringify(evidence.body)),
        )) !== receipt.contentSha256
      )
        return false;
      switch (receipt.kind) {
        case "wayback":
          if (!result.wayback || !same(result.wayback, evidence.body))
            return false;
          break;
        case "wayback-miss":
          if (result.wayback !== null || !isFailure(evidence.body))
            return false;
          break;
        case "github-meta":
          if (
            result.github
              ? !same(result.github.meta, evidence.body)
              : !isFailure(evidence.body)
          )
            return false;
          break;
        case "github-commits":
          if (
            !result.github ||
            (Array.isArray(evidence.body)
              ? !same(result.github.commits, evidence.body)
              : !isFailure(evidence.body) || result.github.commits.length !== 0)
          )
            return false;
          break;
        case "spec":
          if (!result.spec || !same(result.spec, evidence.body)) return false;
          break;
        case "github-manifest":
          if (
            !result.github ||
            (!isManifestEvidence(evidence.body) && !isFailure(evidence.body))
          )
            return false;
          manifestBody = evidence.body;
          break;
        case "registry":
          // Registry lookups only follow a manifest that was read successfully.
          if (!isManifestEvidence(manifestBody)) return false;
          registryBody = evidence.body;
          break;
        default:
          return false;
      }
    }
    if (!seen.has("wayback") && !seen.has("wayback-miss")) return false;
    if (seen.has("wayback") && seen.has("wayback-miss")) return false;
    if (
      result.github &&
      (!seen.has("github-meta") || !seen.has("github-commits"))
    )
      return false;
    if (result.spec && !seen.has("spec")) return false;
    // The displayed autopsy must be exactly what the signed evidence derives.
    if (seen.has("github-manifest")) {
      const derived = buildAutopsy(manifestBody, registryBody);
      if (!derived || !same(derived, result.autopsy)) return false;
    } else if (result.autopsy !== undefined && result.autopsy !== null) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function exportProof(result: ResurrectResponse, url: string): string {
  return JSON.stringify(
    { format: "gravekeeper-proof-v1", resource: url, ...result },
    null,
    2,
  );
}

export function safeSnapshotUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.hostname !== "web.archive.org" ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}
