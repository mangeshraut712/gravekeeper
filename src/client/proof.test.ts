import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { exportProof, safeSnapshotUrl, verifyProof } from "./proof";
import { buildReceipt } from "@/lib/receipts/chain";
import { exportPublicKey, generateKeyPair } from "@/lib/receipts/crypto";
import type { ResurrectResponse } from "@/types";

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
