import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewFrame } from "./PreviewFrame";

describe("PreviewFrame", () => {
  const html = renderToStaticMarkup(
    <PreviewFrame title="Before: original 1999-style fixture" src="/fixtures/lantern-hill/before" />,
  );

  it("keeps the fully restrictive sandbox and an accessible title", () => {
    expect(html).toContain('sandbox=""');
    expect(html).toContain('title="Before: original 1999-style fixture"');
    expect(html).toContain('src="/fixtures/lantern-hill/before"');
  });

  it("starts unfocused and styles a focus ring for when focus moves inside", () => {
    expect(html).toContain('data-focused="false"');
    expect(html).toContain("data-[focused=true]:outline-2");
    expect(html).toContain("data-[focused=true]:outline-amber-200");
  });
});
