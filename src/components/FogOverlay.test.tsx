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
});
