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

  describe("conservative invariants", () => {
    const anyUtf16 = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 64 })
      .map((units) => String.fromCharCode(...units));
    const segs = (s: string) =>
      Array.from(new Intl.Segmenter("en", { granularity: "grapheme" }).segment(s), ({ segment }) => segment);

    it("never throws and returns a string for any UTF-16 input", () => {
      fc.assert(fc.property(anyUtf16, (s) => typeof reverse(s) === "string"));
    });
    it("preserves UTF-16 length, since it only reorders existing segments", () => {
      fc.assert(fc.property(anyUtf16, (s) => reverse(s).length === s.length));
    });
    it("preserves the multiset of UTF-16 code units", () => {
      fc.assert(fc.property(anyUtf16, (s) => {
        const sorted = (x: string) => Array.from({ length: x.length }, (_, i) => x.charCodeAt(i)).sort((a, b) => a - b);
        expect(sorted(reverse(s))).toEqual(sorted(s));
      }));
    });
    it("distributes over concatenation in swapped order when the join does not merge graphemes", () => {
      // Letters and digits never combine across the join, so the segmentation of a+b is the two parts.
      const plain = fc.string({ unit: fc.constantFrom(..."abcXYZ019 ".split("")), maxLength: 32 });
      fc.assert(fc.property(plain, plain, (a, b) => reverse(a + b) === reverse(b) + reverse(a)));
    });
    it("is the identity on empty and single-grapheme strings", () => {
      expect(reverse("")).toBe("");
      fc.assert(fc.property(fc.constantFrom("a", "é", "中", "👩\u200d💻", "👍🏽", "🇮🇳"), (g) => reverse(g) === g));
    });
    it("rejects non-string input", () => {
      expect(() => reverse(42 as unknown as string)).toThrow(TypeError);
    });
    it("leaves segment count of the reversed string equal to the pieces it reordered or lower", () => {
      // Reordering can merge graphemes (leading combining marks) but never split them.
      fc.assert(fc.property(anyUtf16, (s) => segs(reverse(s)).length <= segs(s).length));
    });
  });
});
