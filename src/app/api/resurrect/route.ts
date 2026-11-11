/** Public, read-only lookup. Each receipt includes its exact normalized evidence. */
import { NextRequest } from "next/server";
import type {
  ManifestEvidence,
  Receipt,
  ReceiptKind,
  ResurrectResponse,
} from "@/types";
import { normalizePublicUrl } from "@/shared/url";
import { generateKeyPair, exportPublicKey } from "@/lib/receipts/crypto";
import { buildReceipt } from "@/lib/receipts/chain";
import { fetchWaybackSnapshot } from "@/lib/wayback/client";
import { fetchCdxCaptures } from "@/lib/wayback/cdx";
import { buildTimeline, cdxQueryUrl } from "@/lib/wayback/timeline";
import {
  parseGitHubUrl,
  fetchRepoMeta,
  fetchCommits,
  fetchRootManifest,
  contentsUrl,
} from "@/lib/github/client";
import { parseManifest } from "@/lib/deps/manifest";
import { lookupLatestVersions } from "@/lib/deps/registry";
import { buildAutopsy } from "@/lib/deps/autopsy";
import { generateRevivalSpec } from "@/lib/spec/generator";

export const maxDuration = 30;

function canceled(): Response {
  return Response.json(
    { error: "Lookup canceled.", code: "NETWORK_TIMEOUT" },
    { status: 499 },
  );
}

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
    // Archive, capture index and metadata are independent. Commits are read only after public metadata succeeds.
    const [waybackResult, cdxResult, metaResult] = await Promise.all([
      fetchWaybackSnapshot(url, request.signal),
      fetchCdxCaptures(url, request.signal),
      parsed ? fetchRepoMeta(parsed.owner, parsed.repo, request.signal) : null,
    ]);
    if (request.signal.aborted) return canceled();
    const wayback = waybackResult.ok ? waybackResult.data : null;
    await record(
      waybackResult.ok ? "wayback" : "wayback-miss",
      url,
      waybackResult.ok ? waybackResult.data : { code: waybackResult.code },
    );
    // Recorded right after the first receipt so receipts[0] still names the resource.
    const cdxEvidence = cdxResult.ok ? cdxResult.data : { code: cdxResult.code };
    await record("wayback-cdx", cdxQueryUrl(url), cdxEvidence);
    const timeline = buildTimeline(cdxEvidence);
    let github: ResurrectResponse["github"] = null;
    let spec: ResurrectResponse["spec"] = null;
    let autopsy: ResurrectResponse["autopsy"] = null;
    if (parsed && metaResult) {
      const metaUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      await record(
        "github-meta",
        metaUrl,
        metaResult.ok ? metaResult.data : { code: metaResult.code },
      );
      if (metaResult.ok) {
        // Commits and the root manifest are independent once metadata names the default branch.
        const [commitsResult, manifestResult] = await Promise.all([
          fetchCommits(parsed.owner, parsed.repo, 20, request.signal),
          fetchRootManifest(
            parsed.owner,
            parsed.repo,
            metaResult.data.defaultBranch,
            request.signal,
          ),
        ]);
        if (request.signal.aborted) return canceled();
        await record(
          "github-commits",
          `${metaUrl}/commits?per_page=20`,
          commitsResult.ok ? commitsResult.data : { code: commitsResult.code },
        );
        github = {
          meta: metaResult.data,
          commits: commitsResult.ok ? commitsResult.data : [],
        };
        let manifest: ManifestEvidence | { code: string };
        if (manifestResult.ok) {
          const parsedManifest = parseManifest(
            manifestResult.data.path,
            manifestResult.data.text,
          );
          manifest = parsedManifest.ok
            ? {
                path: manifestResult.data.path,
                rawSha256: manifestResult.data.rawSha256,
                ...parsedManifest.data,
              }
            : { code: parsedManifest.code };
        } else {
          manifest = { code: manifestResult.code };
        }
        await record(
          "github-manifest",
          manifestResult.ok
            ? manifestResult.data.url
            : contentsUrl(parsed.owner, parsed.repo),
          manifest,
        );
        let registry = null;
        if ("packages" in manifest && manifest.packages.length > 0) {
          registry = await lookupLatestVersions(
            manifest.ecosystem,
            manifest.packages,
            request.signal,
          );
          if (request.signal.aborted) return canceled();
          await record("registry", registry.registry, registry);
        }
        autopsy = buildAutopsy(manifest, registry);
        if (commitsResult.ok) {
          spec = generateRevivalSpec(metaResult.data, commitsResult.data, autopsy);
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
      autopsy,
      timeline,
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
