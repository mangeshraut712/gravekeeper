import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LanternHillView } from "@/components/LanternHillView";
import { buildLanternHillDemo } from "@/lib/restore/demo";

describe("Lantern Hill page", () => {
  it("shows the bounded fixture, sandboxed previews, proof tools and trust limits", async () => {
    const html = renderToStaticMarkup(<LanternHillView demo={await buildLanternHillDemo()} />);
    expect(html).toContain("Original Gravekeeper demo fixture");
    expect(html).toContain('title="Before: original 1999-style fixture"');
    expect(html).toContain('title="After: generated HTML5 restoration"');
    expect(html.match(/sandbox=""/g)).toHaveLength(2);
    expect(html).toContain("Download receipt file");
    expect(html).toContain("Verify HTML receipts");
    expect(html).toContain("does not prove authorship");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("dangerouslySetInnerHTML");
  });
});
