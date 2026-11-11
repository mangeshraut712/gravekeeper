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

type ClipboardLike = Pick<Clipboard, "writeText"> & {
  write?: (items: ClipboardItem[]) => Promise<void>;
};
type ClipboardItemCtor = new (items: Record<string, Promise<Blob>>) => ClipboardItem;

/**
 * Copy the issue body only after verification. Must be called synchronously from the
 * click handler: when ClipboardItem exists, the write starts before any await (Safari
 * drops the user gesture across async work) and its text arrives through a promise that
 * rejects if the proof does not verify. Without ClipboardItem it falls back to writeText.
 */
export function copyIssueBody(
  result: ResurrectResponse,
  url: string,
  clipboard: ClipboardLike,
  Item: ClipboardItemCtor | undefined,
): Promise<"copied" | "refused" | "error"> {
  const kit = prepareRevivalKit(result, url);
  if (Item && clipboard.write) {
    let refused = false;
    const text = kit.then((value) => {
      if (!value.ok) {
        refused = true;
        throw new Error("unverified");
      }
      return new Blob([value.issueBody], { type: "text/plain" });
    });
    let write: Promise<void>;
    try {
      write = clipboard.write([new Item({ "text/plain": text })]);
    } catch (error) {
      write = Promise.reject(error);
    }
    return write.then(
      () => "copied" as const,
      async () => {
        await kit;
        return refused ? ("refused" as const) : ("error" as const);
      },
    );
  }
  return kit.then(async (value) => {
    if (!value.ok) return "refused" as const;
    try {
      await clipboard.writeText(value.issueBody);
      return "copied" as const;
    } catch {
      return "error" as const;
    }
  });
}
