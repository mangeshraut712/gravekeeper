import { afterEach, describe, expect, it, vi } from "vitest";
import { compareVersions } from "./compare";

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
