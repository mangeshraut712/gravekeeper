import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../layout";
import RestorationPage from "./page";

describe("restoration demo page", () => {
  it("provides labeled local input, a run action, provenance, and an offline kit", () => {
    const html = renderToStaticMarkup(<RestorationPage />);
    expect(html).toContain('for="restoration-input"');
    expect(html).toContain('id="restoration-input"');
    expect(html).toContain('type="submit"');
    expect(html).toContain('href="/restoration-kit.zip"');
    expect(html).toContain('href="/restoration-report.json"');
    expect(html).toContain('https://github.com/mathiasbynens/esrever/blob/14b34013dad49106ca08c0e65919f1fc8fea5331/esrever.js');
    expect(html).not.toContain('role="alert"');
  });

  it("renders one site footer, not a second page footer", () => {
    const html = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <RestorationPage />
      </RootLayout>,
    );
    expect(html.match(/<footer/g)?.length).toBe(1);
    expect(html).toContain("No affiliation with or endorsement");
    expect(html).toContain('href="/proof"');
  });
});
