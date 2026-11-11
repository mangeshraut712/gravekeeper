/** Unit tests for the CDX client. fetch is always mocked; no real network. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCdxCaptures } from "./cdx";
import { CDX_LIMIT } from "./timeline";

function textResponse(body: string, status = 200, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchCdxCaptures", () => {
  it("requests the monthly-collapsed index for the exact URL and parses rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      textResponse('[["timestamp","statuscode"],["19961022173245","200"],["20090101000000","404"]]'),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchCdxCaptures("http://www.geocities.com/");
    expect(result).toEqual({
      ok: true,
      data: { limit: CDX_LIMIT, timestamps: ["19961022173245", "20090101000000"] },
    });
    const [requested, init] = fetchMock.mock.calls[0];
    const url = new URL(requested);
    expect(url.origin + url.pathname).toBe("https://web.archive.org/cdx/search/cdx");
    expect(url.searchParams.get("url")).toBe("http://www.geocities.com/");
    expect(url.searchParams.get("output")).toBe("json");
    expect(url.searchParams.get("fl")).toBe("timestamp,statuscode");
    expect(url.searchParams.get("collapse")).toBe("timestamp:6");
    expect(url.searchParams.get("limit")).toBe(String(CDX_LIMIT));
    expect(url.searchParams.get("matchType")).toBe("exact");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not request CDX for a wildcard URL", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchCdxCaptures("https://example.com/*");
    expect(result).toMatchObject({ ok: false, code: "PARSE_ERROR" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns an empty capture list for []", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("[]")));
    expect(await fetchCdxCaptures("https://example.com/")).toEqual({
      ok: true,
      data: { limit: CDX_LIMIT, timestamps: [] },
    });
  });

  it("maps malformed bodies to PARSE_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("<html>busy</html>")));
    const result = await fetchCdxCaptures("https://example.com/");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PARSE_ERROR");
  });

  it("rejects an oversized content-length without reading the body", async () => {
    const response = textResponse("[]", 200, { "content-length": String(600 * 1024) });
    const text = vi.spyOn(response, "text");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    const result = await fetchCdxCaptures("https://example.com/");
    expect(result.ok ? null : result.code).toBe("PARSE_ERROR");
    expect(text).not.toHaveBeenCalled();
  });

  it("maps non-2xx to HTTP_ERROR", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(textResponse("busy", 503)));
    const result = await fetchCdxCaptures("https://example.com/");
    expect(result.ok ? null : result.code).toBe("HTTP_ERROR");
  });

  it("maps a timeout to NETWORK_TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")),
    );
    const result = await fetchCdxCaptures("https://example.com/");
    expect(result).toMatchObject({ ok: false, code: "NETWORK_TIMEOUT" });
    if (!result.ok) expect(result.error).toContain("10 seconds");
  });

  it("aborts with the caller's signal and reports NETWORK_TIMEOUT", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_, reject) => {
            init.signal!.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    const controller = new AbortController();
    const pending = fetchCdxCaptures("https://example.com/", controller.signal);
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, code: "NETWORK_TIMEOUT" });
  });

  it("maps a network failure to NETWORK_TIMEOUT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await fetchCdxCaptures("https://example.com/")).toMatchObject({
      ok: false,
      code: "NETWORK_TIMEOUT",
    });
  });
});
