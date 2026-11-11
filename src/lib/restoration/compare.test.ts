import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { compareVersions } from "./compare";
import { reverse } from "./reverse.mts";

afterEach(() => vi.unstubAllGlobals());

describe("restoration comparison", () => {
  it("runs both real algorithms without hard-coding the input", () => {
    expect(compareVersions("A👩‍💻B")).toEqual({
      input: "A👩‍💻B", before: "B💻‍👩A", after: "B👩‍💻A",
    });
  });
  it("allows an empty input", () => {
    expect(compareVersions("")).toEqual({ input: "", before: "", after: "" });
  });
  it("bounds work before running either algorithm", () => {
    expect(() => compareVersions("x".repeat(513))).toThrow("512");
    expect(compareVersions("x".repeat(512)).after).toHaveLength(512);
  });
  it("fails explicitly on browsers without grapheme segmentation", () => {
    vi.stubGlobal("Intl", { ...Intl, Segmenter: undefined });
    expect(() => compareVersions("ghost")).toThrow("Intl.Segmenter");
  });
});

describe("restoration comparison properties", () => {
  it("echoes the input and its after value equals reverse() for any short UTF-16 input", () => {
    const anyUtf16 = fc.array(fc.integer({ min: 0, max: 0xffff }), { maxLength: 64 })
      .map((units) => String.fromCharCode(...units));
    fc.assert(fc.property(anyUtf16, (s) => {
      const r = compareVersions(s);
      return r.input === s && r.after === reverse(s) && typeof r.before === "string";
    }));
  });
  it("agrees with upstream on printable ASCII", () => {
    const ascii = fc.string({ unit: fc.constantFrom(..."abcXYZ019 !?-_".split("")), maxLength: 64 });
    fc.assert(fc.property(ascii, (s) => {
      const r = compareVersions(s);
      return r.before === r.after;
    }));
  });
  it("throws RangeError above 512 UTF-16 units and never at or below", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 700 }), (n) => {
      const input = "a".repeat(n);
      if (n > 512) { expect(() => compareVersions(input)).toThrow(RangeError); }
      else { expect(compareVersions(input).after).toHaveLength(n); }
    }));
  });
});
