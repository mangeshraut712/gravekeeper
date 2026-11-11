import { describe, expect, it } from "vitest";
import { buildReceipt } from "@/lib/receipts/chain";
import { exportPublicKey, generateKeyPair } from "@/lib/receipts/crypto";
import { buildReceiptExport } from "@/lib/receipts/export";
import { exportProof } from "@/client/proof";
import type { ResurrectResponse } from "@/types";
import { analyzeProofText, MAX_PROOF_BYTES } from "./analyze";

const enc = (v: string) => new TextEncoder().encode(v);

async function lookupProof() {
  const { privateKey, publicKey } = await generateKeyPair();
  const body = { code: "WAYBACK_NO_SNAPSHOT" };
  const r0 = await buildReceipt(null, "wayback-miss", "https://example.com/", enc(JSON.stringify(body)), privateKey);
  const result: ResurrectResponse = {
    receipts: [r0],
    spec: null,
    wayback: null,
    github: null,
    publicKey: await exportPublicKey(publicKey),
    evidence: [{ receiptSeq: 0, body }],
  };
  return { result, text: exportProof(result, "https://example.com/") };
}

async function lanternProof() {
  const { privateKey, publicKey } = await generateKeyPair();
  const a = await buildReceipt(null, "fixture", "https://fixture.test/", enc("<p>a</p>"), privateKey);
  const b = await buildReceipt(a, "restoration", "https://fixture.test/#r", enc("<p>b</p>"), privateKey);
  return buildReceiptExport({
    publicKey: await exportPublicKey(publicKey),
    receipts: [a, b],
    beforeHtml: "<p>a</p>",
    afterHtml: "<p>b</p>",
  });
}

describe("analyzeProofText", () => {
  it("accepts a valid live-lookup proof and lists its receipts", async () => {
    const { text } = await lookupProof();
    const report = await analyzeProofText(text);
    expect(report.status).toBe("valid");
    if (report.status === "valid") {
      expect(report.format).toBe("gravekeeper-proof-v1");
      expect(report.receipts).toHaveLength(1);
      expect(report.receipts[0].kind).toBe("wayback-miss");
    }
  });

  it("rejects a lookup proof whose evidence body was edited", async () => {
    const { result } = await lookupProof();
    result.evidence[0].body = { code: "HTTP_ERROR" };
    const report = await analyzeProofText(exportProof(result, "https://example.com/"));
    expect(report.status).toBe("invalid");
  });

  it("rejects a lookup proof whose resource was swapped", async () => {
    const { text } = await lookupProof();
    const edited = JSON.stringify({ ...JSON.parse(text), resource: "https://other.example/" });
    expect((await analyzeProofText(edited)).status).toBe("invalid");
  });

  it("accepts a valid Lantern Hill receipt export", async () => {
    const report = await analyzeProofText(JSON.stringify(await lanternProof()));
    expect(report.status).toBe("valid");
    if (report.status === "valid") expect(report.receipts.map((r) => r.kind)).toEqual(["fixture", "restoration"]);
  });

  it("rejects a receipt export with edited HTML and a changed receipt", async () => {
    const proof = await lanternProof();
    const html = await analyzeProofText(JSON.stringify({ ...proof, artifacts: { ...proof.artifacts, afterHtml: "<p>x</p>" } }));
    expect(html.status).toBe("invalid");
    const receipts = proof.receipts.map((r, i) => (i === 1 ? { ...r, url: "https://evil.test/" } : r));
    const chain = await analyzeProofText(JSON.stringify({ ...proof, receipts }));
    expect(chain.status).toBe("invalid");
    if (chain.status === "invalid") expect(chain.message).toContain("number 2");
  });

  it("treats a malformed signature as invalid, not as a crash", async () => {
    const proof = await lanternProof();
    const receipts = proof.receipts.map((r, i) => (i === 0 ? { ...r, signature: "***" } : r));
    expect((await analyzeProofText(JSON.stringify({ ...proof, receipts }))).status).toBe("invalid");
  });

  it.each([
    ["", "invalid-json"],
    ["{nope", "invalid-json"],
    ["[]", "not-object"],
    ["42", "not-object"],
    ["null", "not-object"],
    ["{}", "unknown-format"],
    ['{"format":"other"}', "unknown-format"],
    ['{"format":"gravekeeper-proof-v1"}', "missing-fields"],
    ['{"format":"gravekeeper-proof-v1","publicKey":"k","receipts":[],"evidence":[]}', "missing-fields"],
    ['{"gravekeeper":"receipt-export","version":1,"publicKey":"k","receipts":[]}', "missing-fields"],
  ])("reports %j as %s", async (text, code) => {
    const report = await analyzeProofText(text);
    expect(report.status).toBe("error");
    if (report.status === "error") expect(report.code).toBe(code);
  });

  it("refuses oversized input before parsing", async () => {
    const report = await analyzeProofText(" ".repeat(MAX_PROOF_BYTES + 1));
    expect(report).toMatchObject({ status: "error", code: "too-large" });
  });

  it("projects only primitive strings and numbers for display", async () => {
    const proof = await lanternProof();
    const bad = { ...proof, receipts: [{ seq: "x", kind: { a: 1 }, url: 5 }, null, ...proof.receipts] };
    const report = await analyzeProofText(JSON.stringify(bad));
    expect(report.status).toBe("invalid");
    if (report.status === "invalid") {
      expect(report.receipts[0]).toEqual({ seq: 0, kind: "", url: "", fetchedAt: "", hash: "", contentSha256: "" });
      expect(report.receipts).toHaveLength(3);
    }
  });
});
