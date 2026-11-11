import { beforeAll, describe, expect, it } from "vitest";
import { prepareRevivalKit } from "./kit";
import { exportProof, verifyProof } from "./proof";
import { buildReceipt, sha256hex } from "@/lib/receipts/chain";
import { exportPublicKey, generateKeyPair } from "@/lib/receipts/crypto";
import { generateRevivalSpec } from "@/lib/spec/generator";
import { CDX_LIMIT, buildTimeline, cdxQueryUrl } from "@/lib/wayback/timeline";
import type { Receipt, ReceiptKind, ResurrectResponse } from "@/types";

const resource = "https://github.com/ghost/repo";
let keys: CryptoKeyPair;
beforeAll(async () => {
  keys = await generateKeyPair();
});

async function signedLookup(): Promise<ResurrectResponse> {
  const wayback = {
    available: true,
    url: resource,
    snapshotUrl: `https://web.archive.org/web/20200101000000/${resource}`,
    timestamp: "20200101000000",
    status: "200",
  };
  const cdx = { limit: CDX_LIMIT, timestamps: ["20140622190015", "20200101000000"] };
  const meta = {
    owner: "ghost",
    repo: "repo",
    fullName: "ghost/repo",
    description: "Haunted <b>repo</b>",
    stars: 1,
    forks: 0,
    openIssues: 2,
    license: "MIT",
    defaultBranch: "main",
    pushedAt: "2019-01-01T00:00:00Z",
    archivedByGitHub: true,
  };
  const commits = [
    { sha: "abc1234", message: "Last words", authorDate: "2019-01-01T00:00:00Z", authorName: "G" },
  ];
  const spec = generateRevivalSpec(meta, commits);
  const bodies: [ReceiptKind, string, unknown][] = [
    ["wayback", resource, wayback],
    ["wayback-cdx", cdxQueryUrl(resource), cdx],
    ["github-meta", resource, meta],
    ["github-commits", resource, commits],
    ["spec", resource, spec],
  ];
  const receipts: Receipt[] = [];
  for (const [kind, url, body] of bodies)
    receipts.push(
      await buildReceipt(
        receipts.at(-1) ?? null,
        kind,
        url,
        new TextEncoder().encode(JSON.stringify(body)),
        keys.privateKey,
      ),
    );
  return {
    publicKey: await exportPublicKey(keys.publicKey),
    receipts,
    evidence: bodies.map(([, , body], receiptSeq) => ({ receiptSeq, body: structuredClone(body) })),
    spec: structuredClone(spec),
    wayback,
    github: { meta: structuredClone(meta), commits: structuredClone(commits) },
    timeline: buildTimeline(cdx),
  };
}

describe("prepareRevivalKit", () => {
  it("builds the kit for a verified lookup, tied to the exported proof bytes", async () => {
    const result = await signedLookup();
    expect(await verifyProof(result, resource)).toBe(true);
    const kit = await prepareRevivalKit(result, resource);
    expect(kit.ok).toBe(true);
    if (!kit.ok) return;
    const expected = await sha256hex(new TextEncoder().encode(exportProof(result, resource)));
    expect(kit.proofSha256).toBe(expected);
    expect(kit.markdown).toContain(`- Proof SHA-256: \`${expected}\``);
    expect(kit.issueBody).toContain(expected);
    expect(kit.markdown).toContain(kit.issueBody);
    expect(kit.markdown).toContain("Haunted &lt;b&gt;repo&lt;/b&gt;");
    expect(kit.markdown).toContain("## Epitaph timeline");
    for (const step of result.spec!.revivalSteps) expect(kit.markdown).toContain(step.order + ". **");
    expect(kit.issueBody.match(/^- \[ \] /gm)).toHaveLength(result.spec!.revivalSteps.length);
  });

  it("refuses when displayed data differs from the signed evidence", async () => {
    const result = await signedLookup();
    result.github!.meta.description = "Edited after signing";
    expect(await prepareRevivalKit(result, resource)).toEqual({ ok: false, reason: "unverified" });
  });

  it("refuses when a plan step was changed after signing", async () => {
    const result = await signedLookup();
    result.spec!.revivalSteps[0].title = "Send me your tokens";
    expect(await prepareRevivalKit(result, resource)).toEqual({ ok: false, reason: "unverified" });
  });

  it("refuses tampered evidence and a different resource", async () => {
    const result = await signedLookup();
    expect(await prepareRevivalKit(result, "https://github.com/other/repo")).toEqual({
      ok: false,
      reason: "unverified",
    });
    (result.evidence[2].body as { stars: number }).stars = 9999;
    expect(await prepareRevivalKit(result, resource)).toEqual({ ok: false, reason: "unverified" });
  });

  it("refuses malformed input without throwing", async () => {
    const result = { ...(await signedLookup()), publicKey: "%%%" };
    expect(await prepareRevivalKit(result, resource)).toEqual({ ok: false, reason: "unverified" });
    expect(
      await prepareRevivalKit(null as unknown as ResurrectResponse, resource),
    ).toEqual({ ok: false, reason: "unverified" });
  });

  it("does not offer a kit for a verified lookup without a plan", async () => {
    const full = await signedLookup();
    const receipts = [full.receipts[0]];
    const result: ResurrectResponse = {
      publicKey: full.publicKey,
      receipts,
      evidence: [full.evidence[0]],
      spec: null,
      wayback: full.wayback,
      github: null,
    };
    expect(await verifyProof(result, resource)).toBe(true);
    expect(await prepareRevivalKit(result, resource)).toEqual({ ok: false, reason: "no-plan" });
  });
});
