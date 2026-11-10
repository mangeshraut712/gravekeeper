import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.json";
import { reverse } from "./reverse.mts";
import upstream from "../../../third_party/esrever/upstream/esrever.js";

// Pins the numbers quoted in README.md and the /restoration page so they cannot drift silently.
describe("restoration fixtures", () => {
  it("have unique ids and non-empty labels", () => {
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
    for (const f of fixtures) expect(f.label.length).toBeGreaterThan(0);
  });

  it("restored implementation passes all 12 documented fixtures", () => {
    expect(fixtures).toHaveLength(12);
    expect(fixtures.filter((f) => reverse(f.input) === f.expected)).toHaveLength(12);
  });

  it("unchanged upstream passes exactly the 4 documented fixtures", () => {
    const passing = fixtures.filter((f) => upstream.reverse(f.input) === f.expected);
    expect(passing.map((f) => f.id)).toEqual(["ascii", "empty", "combining", "astral"]);
  });
});
