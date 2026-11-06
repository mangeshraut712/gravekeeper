import { describe, expect, it } from "vitest";
import fixtures from "./fixtures.json";
import { reverse } from "./reverse.mts";

describe("modern grapheme restoration contract", () => {
  it.each(fixtures)("$label", ({ input, expected }) => {
    expect(reverse(input)).toBe(expected);
  });
});
