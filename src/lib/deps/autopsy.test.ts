import { describe, expect, it } from "vitest";
import type { ManifestEvidence, RegistryEvidence } from "@/types";
import { buildAutopsy, REGISTRY_BASE } from "./autopsy";

const manifest: ManifestEvidence = {
  path: "package.json",
  ecosystem: "npm",
  rawSha256: "a".repeat(64),
  totalDeclared: 6,
  skippedLines: 0,
  truncated: false,
  packages: [
    { name: "react", spec: "^16.14.0", group: "dependencies" },
    { name: "lodash", spec: "^4.17.0", group: "dependencies" },
    { name: "left-pad", spec: "1.3.0", group: "dependencies" },
    { name: "ghost-pkg", spec: "^1.0.0", group: "devDependencies" },
    { name: "local", spec: "file:../local", group: "devDependencies" },
    { name: "jest", spec: "*", group: "devDependencies" },
  ],
};

const registry: RegistryEvidence = {
  registry: REGISTRY_BASE.npm,
  results: [
    { name: "react", latest: "19.2.0", outcome: "ok" },
    { name: "lodash", latest: "4.17.21", outcome: "ok" },
    { name: "left-pad", latest: "1.3.0", outcome: "ok" },
    { name: "ghost-pkg", latest: null, outcome: "not-found" },
    { name: "local", latest: null, outcome: "skipped" },
    { name: "jest", latest: "30.0.0", outcome: "ok" },
  ],
};

describe("buildAutopsy", () => {
  it("classifies every row and counts statuses", () => {
    const autopsy = buildAutopsy(manifest, registry)!;
    expect(autopsy.state).toBe("complete");
    expect(autopsy.manifest).toEqual({
      path: "package.json",
      ecosystem: "npm",
      rawSha256: "a".repeat(64),
      totalDeclared: 6,
      skippedLines: 0,
      truncated: false,
    });
    expect(autopsy.dependencies.map((d) => [d.name, d.floor, d.status])).toEqual([
      ["react", "16.14.0", "major-behind"],
      ["lodash", "4.17.0", "minor-behind"],
      ["left-pad", "1.3.0", "current"],
      ["ghost-pkg", "1.0.0", "not-found"],
      ["local", null, "unknown"],
      ["jest", null, "unknown"],
    ]);
    expect(autopsy.dependencies[4].note).toMatch(/Not a registry version/);
    expect(autopsy.dependencies[5].note).toBe("Declared spec has no lower bound.");
    expect(autopsy.counts).toEqual({
      current: 1,
      "minor-behind": 1,
      "major-behind": 1,
      unknown: 2,
      "not-found": 1,
    });
  });

  it("marks the autopsy partial when a lookup failed", () => {
    const results = registry.results.map((r, i) => (i === 0 ? { ...r, latest: null, outcome: "error" as const } : r));
    const autopsy = buildAutopsy(manifest, { ...registry, results })!;
    expect(autopsy.state).toBe("partial");
    expect(autopsy.dependencies[0]).toMatchObject({ status: "unknown", note: "Registry lookup failed." });
  });

  it("labels a missing manifest and an unavailable manifest", () => {
    expect(buildAutopsy({ code: "MANIFEST_NOT_FOUND" }, null)).toMatchObject({
      state: "no-manifest",
      manifest: null,
      dependencies: [],
    });
    expect(buildAutopsy({ code: "GITHUB_RATE_LIMIT" }, null)?.state).toBe("unavailable");
  });

  it("accepts a manifest with no packages and no registry evidence", () => {
    const empty = { ...manifest, packages: [], totalDeclared: 0 };
    expect(buildAutopsy(empty, null)?.state).toBe("complete");
    expect(buildAutopsy(empty, registry)).toBeNull();
  });

  it.each([
    ["missing registry evidence", manifest, null],
    ["registry for a failed manifest", { code: "MANIFEST_NOT_FOUND" }, registry],
    ["fewer results", manifest, { ...registry, results: registry.results.slice(1) }],
    [
      "renamed result",
      manifest,
      { ...registry, results: registry.results.map((r, i) => (i === 1 ? { ...r, name: "other" } : r)) },
    ],
    ["wrong registry", manifest, { ...registry, registry: REGISTRY_BASE.pypi }],
    [
      "ok without latest",
      manifest,
      { ...registry, results: registry.results.map((r, i) => (i === 0 ? { ...r, latest: null } : r)) },
    ],
    [
      "not-found with latest",
      manifest,
      { ...registry, results: registry.results.map((r, i) => (i === 3 ? { ...r, latest: "1.0.0" } : r)) },
    ],
    ["ecosystem mismatch", { ...manifest, ecosystem: "pypi" }, registry],
    ["bad hash", { ...manifest, rawSha256: "xyz" }, registry],
    ["truncated flag lies", { ...manifest, truncated: true }, registry],
    ["total below packages", { ...manifest, totalDeclared: 2 }, registry],
    ["bad group", { ...manifest, packages: manifest.packages.map((p) => ({ ...p, group: "x" })) }, registry],
    ["not an object", "package.json", registry],
  ])("rejects %s", (_label, manifestBody, registryBody) => {
    expect(buildAutopsy(manifestBody, registryBody)).toBeNull();
  });
});
