import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { exportProof, safeSnapshotUrl, verifyProof } from "./proof";
import { buildReceipt } from "@/lib/receipts/chain";
import { exportPublicKey, generateKeyPair } from "@/lib/receipts/crypto";
import fc from "fast-check";
import type {
  ManifestEvidence,
  Receipt,
  ReceiptKind,
  RegistryEvidence,
  RegistryOutcome,
  ResurrectResponse,
} from "@/types";
import { buildAutopsy, REGISTRY_BASE } from "@/lib/deps/autopsy";
import { generateRevivalSpec } from "@/lib/spec/generator";

async function fixture(): Promise<ResurrectResponse> {
  const keys = await generateKeyPair();
  const wayback = {
    available: true,
    url: "https://example.com/",
    snapshotUrl:
      "https://web.archive.org/web/20200101000000/https://example.com/",
    timestamp: "20200101000000",
    status: "200",
  };
  return {
    publicKey: await exportPublicKey(keys.publicKey),
    receipts: [
      await buildReceipt(
        null,
        "wayback",
        "https://example.com/",
        new TextEncoder().encode(JSON.stringify(wayback)),
        keys.privateKey,
      ),
    ],
    evidence: [{ receiptSeq: 0, body: wayback }],
    spec: null,
    wayback,
    github: null,
  };
}
describe("browser proof tools", () => {
  it("runs the offline CLI and rejects a tampered download", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gravekeeper-test-"));
    try {
      const value = await fixture();
      const file = join(directory, "proof.json");
      writeFileSync(file, exportProof(value, "https://example.com/"));
      expect(
        execFileSync(
          process.execPath,
          [
            "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
            "scripts/verify-proof.ts",
            file,
          ],
          { encoding: "utf8" },
        ),
      ).toContain("Internally consistent");
      value.wayback = { ...value.wayback!, status: "404" };
      writeFileSync(file, exportProof(value, "https://example.com/"));
      expect(
        spawnSync(process.execPath, ["scripts/verify-proof.ts", file]).status,
      ).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  it("verifies the real receipt format", async () => {
    expect(await verifyProof(await fixture())).toBe(true);
  });
  it("rejects a different claimed resource", async () => {
    expect(await verifyProof(await fixture(), "https://other.example/")).toBe(
      false,
    );
  });
  it("rejects changes to displayed data", async () => {
    const value = await fixture();
    value.wayback = { ...value.wayback!, timestamp: "19990101000000" };
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects tampered evidence", async () => {
    const value = await fixture();
    value.evidence[0].body = {};
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects missing evidence", async () => {
    const value = await fixture();
    value.evidence = [];
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects deletion of displayed data", async () => {
    const value = await fixture();
    value.wayback = null;
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects adding an unsigned revival plan", async () => {
    const value = await fixture();
    value.spec = {
      detectedLanguages: [],
      detectedFramework: null,
      staleDeps: [],
      revivalSteps: [],
      generatedAt: "2020-01-01",
    };
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects receipt tampering", async () => {
    const value = await fixture();
    value.receipts[0].url = "https://attacker.example/";
    expect(await verifyProof(value)).toBe(false);
  });
  it("rejects an empty chain", async () => {
    const value = await fixture();
    value.receipts = [];
    expect(await verifyProof(value)).toBe(false);
  });
  it("handles malformed keys without throwing", async () => {
    const value = await fixture();
    value.publicKey = "bad!";
    expect(await verifyProof(value)).toBe(false);
  });
  it("exports the complete key and chain, never a private key", async () => {
    const value = await fixture();
    const exported = JSON.parse(exportProof(value, "https://example.com/"));
    expect(exported).toMatchObject({
      format: "gravekeeper-proof-v1",
      resource: "https://example.com/",
      publicKey: value.publicKey,
      receipts: value.receipts,
    });
    expect(exported).not.toHaveProperty("privateKey");
  });
  it.each([
    "javascript:alert(1)",
    "https://evil.example/",
    "https://web.archive.org.evil.example/",
    "https://user:pass@web.archive.org/",
    "http://web.archive.org:81/",
  ])("rejects untrusted archive link %s", (url) => {
    expect(safeSnapshotUrl(url)).toBeNull();
  });
  it("upgrades valid archive URLs to HTTPS", () => {
    expect(
      safeSnapshotUrl(
        "http://web.archive.org/web/20200101000000/http://example.com",
      ),
    ).toBe("https://web.archive.org/web/20200101000000/http://example.com");
  });
});

// ---------------------------------------------------------------------------
// Dependency autopsy receipts
// ---------------------------------------------------------------------------

type Row = [spec: string, outcome: RegistryOutcome, latest: string];

async function autopsyProof(
  rows: Row[] = [
    ["^16.14.0", "ok", "19.2.0"],
    ["^4.17.0", "ok", "4.17.21"],
    ["^1.0.0", "not-found", ""],
  ],
  keys?: CryptoKeyPair,
): Promise<ResurrectResponse> {
  const pair = keys ?? (await generateKeyPair());
  const resource = "https://github.com/ghost/repo";
  const wayback = { code: "WAYBACK_NO_SNAPSHOT" };
  const meta = {
    owner: "ghost",
    repo: "repo",
    fullName: "ghost/repo",
    description: null,
    stars: 1,
    forks: 0,
    openIssues: 0,
    license: "MIT",
    defaultBranch: "main",
    pushedAt: "2020-01-01T00:00:00Z",
    archivedByGitHub: false,
  };
  const commits = [{ sha: "a", message: "m", authorDate: "2020-01-01T00:00:00Z", authorName: "G" }];
  const packages = rows.map(([spec], i) => ({ name: `pkg${i}`, spec, group: "dependencies" as const }));
  const manifest: ManifestEvidence = {
    path: "package.json",
    ecosystem: "npm",
    rawSha256: "c".repeat(64),
    totalDeclared: packages.length,
    skippedLines: 0,
    truncated: false,
    packages,
  };
  const registry: RegistryEvidence = {
    registry: REGISTRY_BASE.npm,
    results: rows.map(([, outcome, latest], i) => ({
      name: `pkg${i}`,
      latest: outcome === "ok" ? latest : null,
      outcome,
    })),
  };
  const autopsy = buildAutopsy(manifest, packages.length ? registry : null)!;
  const spec = generateRevivalSpec(meta, commits, autopsy);
  const bodies: [ReceiptKind, unknown][] = [
    ["wayback-miss", wayback],
    ["github-meta", meta],
    ["github-commits", commits],
    ["github-manifest", manifest],
    ...(packages.length ? ([["registry", registry]] as [ReceiptKind, unknown][]) : []),
    ["spec", spec],
  ];
  const receipts: Receipt[] = [];
  for (const [kind, body] of bodies)
    receipts.push(
      await buildReceipt(
        receipts.at(-1) ?? null,
        kind,
        resource,
        new TextEncoder().encode(JSON.stringify(body)),
        pair.privateKey,
      ),
    );
  return {
    publicKey: await exportPublicKey(pair.publicKey),
    receipts,
    evidence: bodies.map(([, body], receiptSeq) => ({ receiptSeq, body: structuredClone(body) })),
    spec: structuredClone(spec),
    wayback: null,
    github: { meta, commits },
    autopsy: structuredClone(autopsy),
  };
}

describe("autopsy proof verification", () => {
  it("verifies a proof with manifest and registry receipts", async () => {
    expect(await verifyProof(await autopsyProof())).toBe(true);
  });

  it("verifies a manifest with no packages and no registry receipt", async () => {
    expect(await verifyProof(await autopsyProof([]))).toBe(true);
  });

  it.each([
    ["status", (v: ResurrectResponse) => (v.autopsy!.dependencies[0].status = "current")],
    ["latest", (v: ResurrectResponse) => (v.autopsy!.dependencies[1].latest = "4.17.0")],
    ["declared spec", (v: ResurrectResponse) => (v.autopsy!.dependencies[0].spec = "^19.0.0")],
    ["counts", (v: ResurrectResponse) => (v.autopsy!.counts.current = 9)],
    ["state", (v: ResurrectResponse) => (v.autopsy!.state = "partial")],
    ["removed row", (v: ResurrectResponse) => v.autopsy!.dependencies.pop()],
    ["removed autopsy", (v: ResurrectResponse) => (v.autopsy = null)],
    [
      "manifest evidence",
      (v: ResurrectResponse) => ((v.evidence[3].body as ManifestEvidence).packages[0].spec = "^19.0.0"),
    ],
    [
      "registry evidence",
      (v: ResurrectResponse) => ((v.evidence[4].body as RegistryEvidence).results[0].latest = "16.14.0"),
    ],
  ])("rejects a changed %s", async (_label, mutate) => {
    const value = await autopsyProof();
    mutate(value);
    expect(await verifyProof(value)).toBe(false);
  });

  it("rejects an autopsy without a manifest receipt", async () => {
    const value = await fixture();
    value.autopsy = (await autopsyProof()).autopsy;
    expect(await verifyProof(value)).toBe(false);
  });

  it("rejects a registry receipt that follows a failed manifest", async () => {
    const keys = await generateKeyPair();
    const failed = { code: "MANIFEST_NOT_FOUND" };
    const registry = { registry: REGISTRY_BASE.npm, results: [] };
    const wayback = { code: "WAYBACK_NO_SNAPSHOT" };
    const meta = (await autopsyProof()).github!.meta;
    const bodies: [ReceiptKind, unknown][] = [
      ["wayback-miss", wayback],
      ["github-meta", meta],
      ["github-commits", []],
      ["github-manifest", failed],
      ["registry", registry],
    ];
    const receipts: Receipt[] = [];
    for (const [kind, body] of bodies)
      receipts.push(
        await buildReceipt(receipts.at(-1) ?? null, kind, "https://github.com/ghost/repo", new TextEncoder().encode(JSON.stringify(body)), keys.privateKey),
      );
    const value: ResurrectResponse = {
      publicKey: await exportPublicKey(keys.publicKey),
      receipts,
      evidence: bodies.map(([, body], receiptSeq) => ({ receiptSeq, body })),
      spec: null,
      wayback: null,
      github: { meta, commits: [] },
      autopsy: buildAutopsy(failed, null),
    };
    expect(await verifyProof(value)).toBe(false);
    value.receipts = receipts.slice(0, 4);
    value.evidence = value.evidence.slice(0, 4);
    expect(await verifyProof(value)).toBe(true);
  });

  it("still verifies proofs made before the autopsy existed", async () => {
    const value = await fixture();
    expect(value).not.toHaveProperty("autopsy");
    expect(await verifyProof(value)).toBe(true);
  });

  it("offline CLI rejects a tampered autopsy", async () => {
    const directory = mkdtempSync(join(tmpdir(), "gravekeeper-autopsy-"));
    try {
      const value = await autopsyProof();
      const file = join(directory, "proof.json");
      writeFileSync(file, exportProof(value, "https://github.com/ghost/repo"));
      expect(
        execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/verify-proof.ts", file], {
          encoding: "utf8",
        }),
      ).toContain("Internally consistent: 6 receipts");
      value.autopsy!.dependencies[0].status = "current";
      writeFileSync(file, exportProof(value, "https://github.com/ghost/repo"));
      expect(spawnSync(process.execPath, ["scripts/verify-proof.ts", file]).status).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("property: any tampered autopsy field or evidence fails verification", async () => {
    const keys = await generateKeyPair();
    const row = fc.tuple(
      fc.constantFrom("^1.0.0", "~2.3.0", ">=3.1.0 <4", "*", "file:x", "1.2.3"),
      fc.constantFrom<RegistryOutcome>("ok", "not-found", "error", "skipped"),
      fc.constantFrom("1.0.0", "2.5.1", "9.0.0"),
    );
    const mutations: ((v: ResurrectResponse, i: number) => void)[] = [
      (v, i) => {
        const d = v.autopsy!.dependencies[i];
        d.status = d.status === "current" ? "major-behind" : "current";
      },
      (v, i) => {
        const d = v.autopsy!.dependencies[i];
        d.latest = d.latest === "0.0.1" ? "0.0.2" : "0.0.1";
      },
      (v, i) => (v.autopsy!.dependencies[i].spec += " "),
      (v, i) => (v.autopsy!.dependencies[i].note = `${v.autopsy!.dependencies[i].note}!`),
      (v, i) => (v.autopsy!.dependencies[i].floor = `${v.autopsy!.dependencies[i].floor}.1`),
      (v) => (v.autopsy!.counts.unknown += 1),
      (v) => (v.autopsy!.state = v.autopsy!.state === "complete" ? "partial" : "complete"),
      (v) => (v.autopsy!.manifest!.totalDeclared += 1),
      (v, i) => ((v.evidence[3].body as ManifestEvidence).packages[i].spec += "0"),
      (v, i) => {
        const r = (v.evidence[4].body as RegistryEvidence).results[i];
        r.outcome = r.outcome === "error" ? "not-found" : "error";
      },
    ];
    await fc.assert(
      fc.asyncProperty(
        fc.array(row, { minLength: 1, maxLength: 6 }),
        fc.nat(),
        fc.nat({ max: mutations.length - 1 }),
        async (rows, index, which) => {
          const value = await autopsyProof(rows, keys);
          expect(await verifyProof(value)).toBe(true);
          mutations[which](value, index % rows.length);
          expect(await verifyProof(value)).toBe(false);
        },
      ),
      { numRuns: 60 },
    );
  });
});
