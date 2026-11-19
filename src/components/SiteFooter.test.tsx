import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("keeps the credit line inside the footer landmark", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html.match(/<footer/g)?.length).toBe(1);
    const footer = html.slice(html.indexOf("<footer"), html.indexOf("</footer>") + 9);
    expect(footer).toContain("Gravekeeper · Built for Kiroween 2026");
    expect(footer).toContain("Open source. No ghosts in the fine print.");
    expect(footer).toContain('aria-label="Site"');
  });
});
