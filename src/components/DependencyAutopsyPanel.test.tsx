import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DependencyAutopsy, ManifestEvidence } from "@/types";
import { buildAutopsy, REGISTRY_BASE } from "@/lib/deps/autopsy";
import { DependencyAutopsyPanel } from "./DependencyAutopsyPanel";
import { RevivalSpecPanel } from "./RevivalSpecPanel";

const manifest: ManifestEvidence = {
  path: "package.json",
  ecosystem: "npm",
  rawSha256: "d".repeat(64),
  totalDeclared: 45,
  skippedLines: 1,
  truncated: true,
  packages: [
    { name: "react", spec: "^16.14.0", group: "dependencies" },
    { name: "lodash", spec: "^4.17.0", group: "dependencies" },
    { name: "jest", spec: "*", group: "devDependencies" },
    { name: "ghost-pkg", spec: "^1.0.0", group: "dependencies" },
    { name: "left-pad", spec: "1.3.0", group: "dependencies" },
  ],
};

const autopsy = buildAutopsy(manifest, {
  registry: REGISTRY_BASE.npm,
  results: [
    { name: "react", latest: "19.2.0", outcome: "ok" },
    { name: "lodash", latest: "4.17.21", outcome: "ok" },
    { name: "jest", latest: "30.0.0", outcome: "ok" },
    { name: "ghost-pkg", latest: null, outcome: "not-found" },
    { name: "left-pad", latest: null, outcome: "error" },
  ],
}) as DependencyAutopsy;

describe("DependencyAutopsyPanel", () => {
  const html = renderToStaticMarkup(<DependencyAutopsyPanel autopsy={autopsy} />);

  it("labels the section and states its scope", () => {
    expect(html).toContain('aria-labelledby="autopsy-title"');
    expect(html).toContain("Dependency autopsy");
    expect(html).toContain("package.json · npm");
    expect(html).toContain("declared versions only");
    expect(html).toContain("not a vulnerability scan");
  });

  it("shows summary counts for every status", () => {
    for (const [label, count] of [
      ["Major behind", 1],
      ["Minor behind", 1],
      ["Current", 0],
      ["Unknown", 2],
      ["Not found", 1],
    ] as const)
      expect(html).toMatch(new RegExp(`<dt[^>]*>${label}</dt><dd[^>]*>${count}</dd>`));
  });

  it("renders a captioned table with row headers and text status badges", () => {
    expect(html).toContain("<caption");
    expect(html).toMatch(/<th scope="row"[^>]*>react/);
    expect(html).toContain("^16.14.0");
    expect(html).toContain("19.2.0");
    expect(html).toMatch(/>Major behind<\/span>/);
    expect(html).toMatch(/>Not found<\/span>/);
    expect(html).toContain("Declared spec has no lower bound.");
    expect(html).toMatch(/jest<span[^>]*>dev<\/span>/);
  });

  it("makes the scrolling table keyboard focusable", () => {
    expect(html).toMatch(/<div role="region" aria-labelledby="autopsy-table-caption" tabindex="0"/);
  });

  // Regression for the 2026-11-11 Kiro review: the scroller used to share the
  // section's accessible name, giving two regions with the same label.
  it("names the scrolling region by the table caption, not the section heading", () => {
    expect(html).toMatch(/<caption id="autopsy-table-caption"/);
    expect(html.match(/aria-labelledby="autopsy-title"/g)).toHaveLength(1);
  });

  it("labels partial, truncated and skipped results", () => {
    expect(html).toContain("Partial result: some registry lookups failed.");
    expect(html).toContain("Showing the first 5 of 45 declared packages.");
    expect(html).toContain("1 entry in package.json could not be parsed and was skipped.");
  });

  it("adds no animation classes", () => {
    expect(html).not.toMatch(/animate-/);
  });

  it("explains a missing or unreadable manifest without a table", () => {
    const none = renderToStaticMarkup(
      <DependencyAutopsyPanel autopsy={buildAutopsy({ code: "MANIFEST_NOT_FOUND" }, null)!} />,
    );
    expect(none).toContain("No manifest read");
    expect(none).toContain("The revival plan uses metadata only.");
    expect(none).not.toContain("<table");
    const unreadable = renderToStaticMarkup(
      <DependencyAutopsyPanel autopsy={buildAutopsy({ code: "PARSE_ERROR" }, null)!} />,
    );
    expect(unreadable).toContain("The root manifest could not be read.");
  });

  it("says when a manifest declares nothing", () => {
    const empty = buildAutopsy({ ...manifest, packages: [], totalDeclared: 0, truncated: false, skippedLines: 0 }, null)!;
    const markup = renderToStaticMarkup(<DependencyAutopsyPanel autopsy={empty} />);
    expect(markup).toContain("package.json declares no dependencies that Gravekeeper reads.");
  });
});

describe("RevivalSpecPanel with dependency data", () => {
  it("updates the scope line when the plan used the manifest", () => {
    const spec = {
      detectedLanguages: [],
      detectedFramework: null,
      staleDeps: [],
      revivalSteps: [{ order: 1, title: "x", description: "y" }],
      generatedAt: "2026-11-11T00:00:00.000Z",
    };
    expect(renderToStaticMarkup(<RevivalSpecPanel spec={spec} usesDependencies />)).toContain(
      "Metadata and declared-dependency plan · no source code or vulnerability audit",
    );
  });
});
