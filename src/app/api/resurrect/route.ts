/** Public, read-only lookup. Each receipt includes its exact normalized evidence. */
import { NextRequest } from "next/server";
import type { Receipt, ReceiptKind, ResurrectResponse } from "@/types";
import { normalizePublicUrl } from "@/shared/url";
import { generateKeyPair, exportPublicKey } from "@/lib/receipts/crypto";
import { buildReceipt } from "@/lib/receipts/chain";
import { fetchWaybackSnapshot } from "@/lib/wayback/client";
import {
  parseGitHubUrl,
  fetchRepoMeta,
  fetchCommits,
} from "@/lib/github/client";
import { generateRevivalSpec } from "@/lib/spec/generator";

export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON.", code: "PARSE_ERROR" },
      { status: 400 },
    );
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as { url?: unknown }).url !== "string"
  ) {
    return Response.json(
      { error: 'Body must include a string "url" field.', code: "PARSE_ERROR" },
      { status: 400 },
    );
  }
  const url = normalizePublicUrl((body as { url: string }).url);
  if (!url)
    return Response.json(
      {
        error:
          "Enter a public HTTP(S) URL without credentials, query strings, or local addresses.",
        code: "PARSE_ERROR",
      },
      { status: 400 },
    );

  try {
    const { privateKey, publicKey } = await generateKeyPair();
    const receipts: Receipt[] = [];
    const evidence: ResurrectResponse["evidence"] = [];
    async function record(kind: ReceiptKind, source: string, payload: unknown) {
      const receipt = await buildReceipt(
        receipts.at(-1) ?? null,
        kind,
        source,
        new TextEncoder().encode(JSON.stringify(payload)),
        privateKey,
      );
      receipts.push(receipt);
      evidence.push({ receiptSeq: receipt.seq, body: payload });
    }
    const parsed = parseGitHubUrl(url);
    // Archive and metadata are independent. Commits are read only after public metadata succeeds.
    const [waybackResult, metaResult] = await Promise.all([
      fetchWaybackSnapshot(url, request.signal),
      parsed ? fetchRepoMeta(parsed.owner, parsed.repo, request.signal) : null,
    ]);
    if (request.signal.aborted)
      return Response.json(
        { error: "Lookup canceled.", code: "NETWORK_TIMEOUT" },
        { status: 499 },
      );
    const wayback = waybackResult.ok ? waybackResult.data : null;
    await record(
      waybackResult.ok ? "wayback" : "wayback-miss",
      url,
      waybackResult.ok ? waybackResult.data : { code: waybackResult.code },
    );
    let github: ResurrectResponse["github"] = null;
    let spec: ResurrectResponse["spec"] = null;
    if (parsed && metaResult) {
      const metaUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      await record(
        "github-meta",
        metaUrl,
        metaResult.ok ? metaResult.data : { code: metaResult.code },
      );
      if (metaResult.ok) {
        const commitsResult = await fetchCommits(
          parsed.owner,
          parsed.repo,
          20,
          request.signal,
        );
        if (request.signal.aborted)
          return Response.json(
            { error: "Lookup canceled.", code: "NETWORK_TIMEOUT" },
            { status: 499 },
          );
        await record(
          "github-commits",
          `${metaUrl}/commits?per_page=20`,
          commitsResult.ok ? commitsResult.data : { code: commitsResult.code },
        );
        github = {
          meta: metaResult.data,
          commits: commitsResult.ok ? commitsResult.data : [],
        };
        if (commitsResult.ok) {
          spec = generateRevivalSpec(metaResult.data, commitsResult.data);
          await record("spec", url, spec);
        }
      }
    }
    const response: ResurrectResponse = {
      receipts,
      evidence,
      spec,
      wayback,
      github,
      publicKey: await exportPublicKey(publicKey),
    };
    return Response.json(response, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        error: "Unable to complete this lookup. Please try again.",
        code: "HTTP_ERROR",
      },
      { status: 500 },
    );
  }
}
