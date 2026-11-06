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

describe("restoration properties", () => {
  it("is an involution on any string", () => {
    fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 64 }), (s) => reverse(reverse(s)) === s));
  });
  it("preserves grapheme count", () => {
    fc.assert(fc.property(fc.string({ unit: "grapheme", maxLength: 64 }), (s) => count(reverse(s)) === count(s)));
  });
  it("matches upstream esrever on ASCII", () => {
    fc.assert(fc.property(fc.string({ unit: "binary-ascii", maxLength: 64 }), (s) => reverse(s) === upstream.reverse(s)));
  });
});
