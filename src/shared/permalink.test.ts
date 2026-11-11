import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { permalinkFor, readPermalink } from "./permalink";
import { normalizePublicUrl } from "./url";

const here = { origin: "https://gravekeeper.example", pathname: "/" };

describe("readPermalink", () => {
  it("returns none without a url parameter", () => {
    expect(readPermalink("")).toEqual({ kind: "none" });
    expect(readPermalink("?other=1")).toEqual({ kind: "none" });
  });
  it("accepts and normalizes a public URL", () => {
    expect(readPermalink("?url=" + encodeURIComponent("https://github.com/atom/atom"))).toEqual({
      kind: "lookup",
      url: "https://github.com/atom/atom",
    });
    expect(readPermalink("?url=http%3A%2F%2Fwww.geocities.com")).toEqual({
      kind: "lookup",
      url: "http://www.geocities.com/",
    });
  });
  it.each([
    "not a url",
    "javascript:alert(1)",
    "http://localhost/admin",
    "http://192.168.1.2/",
    "http://printer.local/",
    "https://user:pass@example.com/",
    "https://example.com/?token=secret",
    "https://example.com:8443/",
    "https://example.com/*",
    "",
  ])("rejects %j without a lookup", (value) => {
    expect(readPermalink("?url=" + encodeURIComponent(value))).toEqual({ kind: "rejected" });
  });
  it("rejects a repeated url parameter", () => {
    expect(readPermalink("?url=https%3A%2F%2Fa.example%2F&url=https%3A%2F%2Fb.example%2F")).toEqual({
      kind: "rejected",
    });
  });
});

describe("permalinkFor", () => {
  it("keeps the path and encodes only the resource", () => {
    expect(permalinkFor("https://github.com/atom/atom", here)).toBe(
      "https://gravekeeper.example/?url=https%3A%2F%2Fgithub.com%2Fatom%2Fatom",
    );
  });
  it("round-trips any accepted URL", () => {
    const host = fc.stringMatching(/^[a-z][a-z0-9-]{0,10}\.(com|org|net|io)$/);
    const path = fc.stringMatching(/^(\/[a-zA-Z0-9._~%-]{0,8}){0,3}$/);
    fc.assert(
      fc.property(fc.constantFrom("http", "https"), host, path, (scheme, h, p) => {
        const resource = normalizePublicUrl(`${scheme}://${h}${p}`);
        fc.pre(resource !== null);
        const link = new URL(permalinkFor(resource!, here));
        expect(readPermalink(link.search)).toEqual({ kind: "lookup", url: resource });
      }),
    );
  });
});
