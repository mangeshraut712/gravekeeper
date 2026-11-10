import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.json";
import { reverse } from "./reverse.mts";

describe("modern grapheme restoration contract", () => {
  it.each(fixtures)("$label", ({ input, expected }) => {
    expect(reverse(input)).toBe(expected);
  });
});

import fc from "fast-check";
import upstream from "../../../third_party/esrever/upstream/esrever.js";

const count = (s: string) =>
  Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s)).length;

// These complete graphemes keep their boundaries in every generated ordering.
// Arbitrary Unicode strings do not: a leading combining mark can attach to a
// different base after reversal. Keep that limit visible below.
const stableString = fc.array(fc.constantFrom("a", "Z", "9", " ", "é", "中", "👩‍💻", "👍🏽"), { maxLength: 64 }).map((parts) => parts.join(""));

describe("restoration properties", () => {
  it("is an involution on the boundary-stable grapheme alphabet", () => {
    fc.assert(fc.property(stableString, (s) => reverse(reverse(s)) === s));
  });
  it("preserves grapheme count on the boundary-stable alphabet", () => {
    fc.assert(fc.property(stableString, (s) => count(reverse(s)) === count(s)));
  });
  it("documents that leading combining marks can merge after reversal", () => {
    const input = "\u0301a";
    expect(reverse(input)).toBe("a\u0301");
    expect(reverse(reverse(input))).toBe("a\u0301");
    expect(reverse(reverse(input))).not.toBe(input);
    expect(count(input)).toBe(2);
    expect(count(reverse(input))).toBe(1);
  });
  it("reverses the original segmented pieces for arbitrary UTF-16 input", () => {
    const arbitraryUtf16 = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 64 })
      .map((units) => String.fromCharCode(...units));
    fc.assert(fc.property(arbitraryUtf16, (s) => {
      const parts = Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s), ({ segment }) => segment);
      expect(reverse(s)).toBe(parts.reverse().join(""));
    }));
  });
  it("matches upstream esrever on the generated printable ASCII alphabet", () => {
    fc.assert(fc.property(fc.string({ unit: fc.constantFrom(..."abcXYZ019 !?-_".split("")), maxLength: 64 }), (s) => reverse(s) === upstream.reverse(s)));
  });
});
