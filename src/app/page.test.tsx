import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "./page";

describe("Gravekeeper landing page", () => {
  it("renders a labeled lookup form and privacy notice instead of the starter page", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Good code deserves");
    expect(html).toContain("Repository or website URL");
    expect(html).toContain("Internet Archive");
    expect(html).not.toContain("To get started");
    expect(html).toContain('href="/restoration"');
    expect(html).toContain('href="/lantern-hill"');
  });
  it("uses readable muted text for the dark landing page", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).not.toMatch(/<(?:p|span|footer)[^>]*class="[^"]*text-stone-500/);
  });
  it("starts with no fabricated results and explains receipt limitations", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("No lookups yet");
    expect(html).toContain("not proof of authorship");
    expect(html).not.toContain("Chain verified");
  });
});
