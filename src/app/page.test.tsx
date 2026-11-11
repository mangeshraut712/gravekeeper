import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RootLayout from "./layout";
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

  it("renders one site footer, not a second page footer", () => {
    const html = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <Home />
      </RootLayout>,
    );
    expect(html.match(/<footer/g)?.length).toBe(1);
    expect(html).toContain('href="/proof"');
    expect(html).toContain("Built for Kiroween 2026");
  });

  it("places decorative fog behind the workbench and hides it for reduced motion", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toMatch(
      /<div[^>]*pointer-events-none[^>]*z-0[^>]*motion-reduce:hidden[^>]*aria-hidden="true"[^>]*data-testid="fog-overlay"/,
    );
    expect(html).toContain("relative z-10");
    expect(html).toContain("fog-layer-a");
  });
});
