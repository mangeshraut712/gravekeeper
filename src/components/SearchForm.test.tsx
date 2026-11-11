import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchForm } from "./SearchForm";

describe("SearchForm initial markup", () => {
  const html = renderToStaticMarkup(
    <SearchForm onLoadingChange={() => {}} onResult={() => {}} />,
  );

  it("labels the URL input and wires descriptions", () => {
    expect(html).toContain('<label for="resource-url"');
    expect(html).toContain("Repository or website URL");
    expect(html).toContain('id="resource-url"');
    expect(html).toContain('aria-describedby="lookup-privacy lookup-error"');
    expect(html).toContain('aria-invalid="false"');
  });

  it("has an empty polite-status region and a privacy notice", () => {
    expect(html).toMatch(/<p id="lookup-error" role="status"[^>]*><\/p>/);
    expect(html).toContain('id="lookup-privacy"');
    expect(html).toContain("Public URLs only.");
  });

  it("renders an enabled submit button with an aria-hidden arrow and no cancel", () => {
    expect(html).toContain("Unearth project");
    expect(html).toContain('<span aria-hidden="true">↗</span>');
    expect(html).not.toContain("Cancel");
    expect(html).not.toMatch(/<button type="submit"[^>]*\sdisabled(=""|[\s>])/);
  });

  it("offers example starters", () => {
    expect(html).toContain("Need a starting point?");
    expect(html).toContain("atom/atom");
    expect(html).toContain("facebookarchive/flux");
  });
});
