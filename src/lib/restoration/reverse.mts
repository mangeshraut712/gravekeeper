/**
 * Gravekeeper's bounded modernization of esrever's reverse API.
 * Uses the host runtime's Unicode grapheme data; not a full package/CLI port.
 * See third_party/esrever/README.md for source and MIT attribution.
 */
export function reverse(input: string): string {
  if (typeof input !== "string") throw new TypeError("Expected a string.");
  if (typeof Intl.Segmenter !== "function") {
    throw new Error("This demo requires a browser with Intl.Segmenter support.");
  }
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  return Array.from(segmenter.segment(input), ({ segment }) => segment)
    .reverse()
    .join("");
}
