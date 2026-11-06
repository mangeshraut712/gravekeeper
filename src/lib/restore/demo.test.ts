import { describe, expect, it, vi } from "vitest";
import { buildLanternHillDemo } from "./demo";
import { verifyReceiptExport } from "../receipts/export";
import { LANTERN_HILL_HTML } from "./fixture";

describe("Lantern Hill demo", () => {
  it("generates both documents and a valid proof without fetching anything", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network allowed"));
    try {
      const demo = await buildLanternHillDemo();
      expect(fetch).not.toHaveBeenCalled();
      expect(demo.proof.artifacts?.beforeHtml).toBe(LANTERN_HILL_HTML);
      expect(demo.proof.artifacts?.afterHtml).toContain("<h1>Lantern Hill</h1>");
      expect(demo.proof.receipts.map((receipt) => receipt.kind)).toEqual(["fixture", "restoration"]);
      expect(await verifyReceiptExport(demo.proof)).toMatchObject({ valid: true, artifacts: { before: true, after: true } });
      expect(demo.changes.length).toBeGreaterThan(0);
      expect(demo).not.toHaveProperty("privateKey");
    } finally {
      fetch.mockRestore();
    }
  });
});
