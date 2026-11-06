import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
});
