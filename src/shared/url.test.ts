import { describe, expect, it } from "vitest";
import { isGitHubRepository, normalizePublicUrl } from "./url";

describe("normalizePublicUrl", () => {
  it("returns a canonical href for public pages", () => {
    expect(normalizePublicUrl("https://example.com/path")).toBe("https://example.com/path");
    expect(normalizePublicUrl("  https://example.com/p#section  ")).toBe("https://example.com/p");
    expect(normalizePublicUrl("https://EXAMPLE.com/")).toBe("https://example.com/");
    // URL parsing drops default ports, so they must not count as explicit ports.
    expect(normalizePublicUrl("https://example.com:443/")).toBe("https://example.com/");
  });

  it("canonicalizes a trailing-dot host to the same resource URL", () => {
    // The TLD and IP checks strip the DNS root dot before matching, so the returned
    // URL must use the same host. Otherwise receipts, permalinks, and archive
    // lookups split one site into two resources.
    expect(normalizePublicUrl("https://example.com./path")).toBe("https://example.com/path");
  });

  it("is idempotent, so the form and the API sign the same URL", () => {
    for (const input of ["https://Example.com./a#x", "https://example.com:443/b", "http://example.org"]) {
      const once = normalizePublicUrl(input);
      expect(once).not.toBeNull();
      expect(normalizePublicUrl(once as string)).toBe(once);
    }
  });

  it.each([
    ["credentials", "https://user:pass@example.com/"],
    ["explicit port", "https://example.com:8443/"],
    ["query string", "https://example.com/?q=1"],
    ["non-http scheme", "ftp://example.com/"],
    ["IPv4 literal", "http://192.168.1.1/"],
    ["IPv4 in decimal form", "http://2130706433/"],
    ["IPv6 literal", "http://[::1]/"],
    ["single-label host", "http://fileserver/"],
    ["trailing-dot localhost", "http://localhost./"],
    ["two trailing dots", "https://example.com../path"],
    [".localhost suffix", "http://a.localhost/"],
    [".local suffix", "http://printer.local/"],
    [".internal suffix", "http://db.internal/"],
    [".test suffix", "http://site.test/"],
    [".invalid suffix", "http://site.invalid/"],
    ["CDX wildcard", "https://example.com/*"],
    ["no scheme", "example.com/path"],
    ["empty input", ""],
  ])("rejects %s", (_name, input) => {
    expect(normalizePublicUrl(input)).toBeNull();
  });

  it("rejects inputs longer than 2048 characters", () => {
    expect(normalizePublicUrl(`https://example.com/${"a".repeat(2048)}`)).toBeNull();
  });
});

describe("isGitHubRepository", () => {
  it("accepts well-formed owner/repo pairs", () => {
    expect(isGitHubRepository("mangeshraut712", "gravekeeper")).toBe(true);
    expect(isGitHubRepository("a", "x")).toBe(true);
    expect(isGitHubRepository("a".repeat(39), "r".repeat(100))).toBe(true);
  });

  it.each([
    ["empty owner", "", "repo"],
    ["owner starting with a hyphen", "-team", "repo"],
    ["owner ending with a hyphen", "team-", "repo"],
    ["40-character owner", "a".repeat(40), "repo"],
    ["owner with a slash", "a/b", "repo"],
    ["empty repo", "owner", ""],
    ["dot repo", "owner", "."],
    ["dot-dot repo", "owner", ".."],
    ["repo with a slash", "owner", "a/b"],
    ["repo with a percent escape", "owner", "a%2Fb"],
    ["101-character repo", "owner", "a".repeat(101)],
  ])("rejects %s", (_name, owner, repo) => {
    expect(isGitHubRepository(owner, repo)).toBe(false);
  });
});
