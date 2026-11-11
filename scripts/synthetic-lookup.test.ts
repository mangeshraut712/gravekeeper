import { describe, expect, it } from "vitest";
import { verifyProof } from "../src/client/proof.ts";
import type { ResurrectResponse } from "../src/types/index.ts";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";

// scripts/a11y-audit.mts and scripts/polish-check.mts scan the results page with this
// response. If it stopped verifying, the Revival kit would show "refused" instead of the
// downloaded state, and the scan would no longer cover what it says it covers.
describe("synthetic lookup used by the browser scans", () => {
  it("verifies as a proof for its resource", async () => {
    const result = (await buildSyntheticLookup()) as ResurrectResponse;
    expect(await verifyProof(result, syntheticRepoUrl)).toBe(true);
  });

  it("renders every results panel with data", async () => {
    const result = (await buildSyntheticLookup()) as ResurrectResponse;
    expect(result.timeline?.state).toBe("complete");
    expect(result.autopsy?.state).toBe("complete");
    expect(result.autopsy?.dependencies.length).toBeGreaterThan(0);
    expect(result.spec).not.toBeNull();
    expect(result.github).not.toBeNull();
    expect(result.receipts.map((r) => r.kind)).toEqual([
      "wayback",
      "wayback-cdx",
      "github-meta",
      "github-commits",
      "github-manifest",
      "registry",
      "spec",
    ]);
  });

  it("is refused once the displayed autopsy differs from the signed evidence", async () => {
    const result = (await buildSyntheticLookup()) as ResurrectResponse;
    result.autopsy!.dependencies[0].latest = "99.0.0";
    expect(await verifyProof(result, syntheticRepoUrl)).toBe(false);
  });
});
