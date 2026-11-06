import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const script = join(root, "scripts/verify-restoration.mts");

describe("offline restoration verifier", () => {
  it("reruns both implementations and reports the real before/after checks", () => {
    const report = JSON.parse(execFileSync(process.execPath, [script, "--json"], { encoding: "utf8" }));
    expect(report.summary).toEqual({ total: 12, beforePassed: 4, afterPassed: 12, improvements: 8 });
    expect(report.results.find((r: { id: string }) => r.id === "flag")).toMatchObject({
      before: "!🇳🇮", after: "!🇮🇳", expected: "!🇮🇳", beforePassed: false, afterPassed: true,
    });
    expect(report.source.gitBlobSha1).toBe("0df77a567a8571656165c12d02acb3f92592473c");
  });
  it("exits nonzero when checking the unchanged upstream against the new contract", () => {
    const result = spawnSync(process.execPath, [script, "--baseline"], { encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("4/12");
  });
  it("rejects altered upstream bytes before executing them", () => {
    const temp = mkdtempSync(join(tmpdir(), "gravekeeper-verifier-"));
    try {
      for (const path of ["scripts", "src/lib/restoration", "third_party/esrever"])
        cpSync(join(root, path), join(temp, path), { recursive: true });
      const upstream = join(temp, "third_party/esrever/upstream/esrever.js");
      writeFileSync(upstream, readFileSync(upstream, "utf8") + "\nthrow new Error('MUST NOT EXECUTE');\n");
      const result = spawnSync(process.execPath, [join(temp, "scripts/verify-restoration.mts")], { encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Upstream source does not match");
      expect(result.stderr).not.toContain("MUST NOT EXECUTE");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
