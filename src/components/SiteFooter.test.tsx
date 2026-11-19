import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteFooter } from "./SiteFooter";

function footerMarkup() {
  const html = renderToStaticMarkup(<SiteFooter />);
  const footers = html.match(/<footer[\s>][\s\S]*?<\/footer>/g) ?? [];
  expect(footers).toHaveLength(1);
  return footers[0] ?? "";
}

describe("SiteFooter", () => {
  it("keeps the credit line inside the footer landmark", () => {
    const footer = footerMarkup();
    expect(footer).toContain("Gravekeeper · Built for Kiroween 2026");
    expect(footer).toContain("Open source. No ghosts in the fine print.");
  });

  it("keeps every site link inside the labelled footer nav", () => {
    const footer = footerMarkup();
    const nav = footer.match(/<nav aria-label="Site"[\s\S]*?<\/nav>/)?.[0] ?? "";
    for (const [href, label] of [
      ["/", "Home"],
      ["/restoration", "Restoration"],
      ["/lantern-hill", "Lantern Hill"],
      ["/proof", "Check a proof"],
    ]) {
      expect(nav).toMatch(new RegExp(`<a [^>]*href="${href}"[^>]*>${label}</a>`));
    }
  });
});
