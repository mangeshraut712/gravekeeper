import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchForm, readLookupResponse } from "./SearchForm";

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

  it("reserves status-line height so loading text does not shift the page", () => {
    expect(html).toMatch(/<p id="lookup-error" role="status" class="[^"]*\bmin-h-10\b[^"]*\bmd:min-h-5\b/);
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

// Regression for the 2026-11-11 Kiro review: a platform timeout or error page is
// HTML or plain text, and response.json() used to surface the raw SyntaxError.
describe("readLookupResponse", () => {
  async function message(response: Response): Promise<string> {
    try {
      await readLookupResponse(response);
      return "resolved";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }

  it("shows a plain message for a non-JSON error page", async () => {
    const html = new Response("<!DOCTYPE html><title>504</title>", {
      status: 504,
      headers: { "content-type": "text/html" },
    });
    expect(await message(html)).toBe("The lookup failed. Please try again.");
  });

  it("uses the server's error text for a JSON error", async () => {
    const json = Response.json({ error: "Enter a public URL.", code: "PARSE_ERROR" }, { status: 400 });
    expect(await message(json)).toBe("Enter a public URL.");
  });

  it("treats a non-JSON or incomplete success body as incomplete", async () => {
    expect(await message(new Response("ok", { status: 200 }))).toBe(
      "The server returned an incomplete response. Please retry.",
    );
    expect(await message(Response.json({ receipts: [] }))).toBe(
      "The server returned an incomplete response. Please retry.",
    );
  });

  it("returns a complete response body", async () => {
    const body = { receipts: [], evidence: [], publicKey: "k", spec: null, wayback: null, github: null };
    await expect(readLookupResponse(Response.json(body))).resolves.toEqual(body);
  });
});
