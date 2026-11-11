import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { RevivalSpec } from "@/types";
import { RevivalSpecPanel } from "./RevivalSpecPanel";

const spec: RevivalSpec = {
  detectedLanguages: ["TypeScript", "Go"],
  detectedFramework: "Next.js",
  staleDeps: [
    { name: "repository", detectedVersion: null, reason: "archived", suggestion: "Fork it" },
    { name: "left-pad", detectedVersion: null, reason: "unknown", suggestion: null },
  ],
  revivalSteps: [
    { order: 1, title: "Fork and clone", description: "Get a copy." },
    { order: 2, title: "Update README", description: "Explain status." },
  ],
  generatedAt: "2026-11-03T06:09:00.000Z",
};

describe("RevivalSpecPanel", () => {
  const html = renderToStaticMarkup(<RevivalSpecPanel spec={spec} />);

  it("labels the section and states its metadata-only scope", () => {
    expect(html).toContain('aria-labelledby="plan-title"');
    expect(html).toContain("A path back to life");
    expect(html).toContain("2 next steps");
    expect(html).toContain("Metadata-based plan · no source code audit");
  });

  it("lists the detected stack and framework", () => {
    expect(html).toContain("Detected stack");
    expect(html).toContain("TypeScript");
    expect(html).toContain("Go");
    expect(html).toContain("Framework: Next.js");
  });

  it("shows maintenance flags with reason badges", () => {
    expect(html).toContain("Maintenance flags");
    expect(html).toContain("repository: Fork it");
    expect(html).toContain("left-pad: unknown");
    expect(html).toContain(">archived</span>");
  });

  it("renders revival steps in order inside an open details", () => {
    expect(html).toMatch(/<details[^>]*\sopen=""[^>]*>/);
    expect(html.indexOf("Fork and clone")).toBeLessThan(html.indexOf("Update README"));
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
    expect(html).toContain("<ol");
  });

  it("uses native details and a decorative chevron with motion-reduce classes", () => {
    expect(html.match(/<details/g)).toHaveLength(3);
    expect(html).toMatch(/<span class="[^"]*motion-reduce:transition-none[^"]*" aria-hidden="true">▸<\/span>/);
    expect(html).toContain("motion-reduce:group-open:rotate-0");
  });

  it("omits maintenance flags when none exist and handles no language", () => {
    const empty = renderToStaticMarkup(
      <RevivalSpecPanel
        spec={{ ...spec, staleDeps: [], detectedLanguages: [], detectedFramework: null }}
      />,
    );
    expect(empty).not.toContain("Maintenance flags");
    expect(empty).toContain("No language reported.");
    expect(empty).not.toContain("Framework:");
    expect(empty.match(/<details/g)).toHaveLength(2);
  });
});
