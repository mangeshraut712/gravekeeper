import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import FogOverlay from "./FogOverlay";

describe("FogOverlay", () => {
  const html = renderToStaticMarkup(<FogOverlay />);

  it("is decorative and hidden from assistive tech", () => {
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events-none");
  });

  it("hides the animated layers when the visitor prefers reduced motion", () => {
    expect(html).toContain("motion-reduce:hidden");
  });

  it("renders two drifting fog layers", () => {
    expect(html).toContain("fog-layer fog-layer-a");
    expect(html).toContain("fog-layer fog-layer-b");
  });

  it("keeps the dimmest body text at 4.5:1 even if every fog gradient overlapped", () => {
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const layers = [...css.matchAll(/radial-gradient\([^)]*?rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)/g)].map(
      (m) => ({ rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) }),
    );
    expect(layers).toHaveLength(4);
    // Worst case: all four layers composited at peak alpha on the page colour #111510.
    let px = [0x11, 0x15, 0x10];
    for (const { rgb, alpha } of layers) px = px.map((v, i) => v * (1 - alpha) + rgb[i] * alpha);
    const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const stone400 = [0xa6, 0xa0, 0x9b]; // lightest muted text colour in use
    const ratio = (lum(stone400) + 0.05) / (lum(px) + 0.05);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
