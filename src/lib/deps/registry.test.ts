/** Registry client tests. fetch is always mocked; no real HTTP. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DeclaredDependency } from "@/types";
import {
  fetchLatestVersion,
  isValidPackageName,
  lookupLatestVersions,
  registryUrl,
} from "./registry";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const dep = (name: string, spec = "^1.0.0"): DeclaredDependency => ({ name, spec, group: "dependencies" });

afterEach(() => vi.unstubAllGlobals());

describe("isValidPackageName and registryUrl", () => {
  it.each([
    ["react", "npm", true],
    ["@types/node", "npm", true],
    ["JSONStream", "npm", true],
    ["../etc", "npm", false],
    ["a b", "npm", false],
    ["@scope/x/y", "npm", false],
    ["Django", "pypi", true],
    ["zope-interface", "pypi", true],
    ["-bad", "pypi", false],
    ["a/b", "pypi", false],
  ] as const)("%s (%s) → %s", (name, ecosystem, valid) => {
    expect(isValidPackageName(name, ecosystem)).toBe(valid);
  });

  it("builds registry URLs and encodes scoped names", () => {
    expect(registryUrl("npm", "react")).toBe("https://registry.npmjs.org/react/latest");
    expect(registryUrl("npm", "@types/node")).toBe("https://registry.npmjs.org/@types%2Fnode/latest");
    expect(registryUrl("pypi", "django")).toBe("https://pypi.org/pypi/django/json");
  });
});

describe("fetchLatestVersion", () => {
  it("reads npm version and PyPI info.version", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ version: "19.2.0" })));
    expect(await fetchLatestVersion("npm", "react")).toEqual({ latest: "19.2.0", outcome: "ok" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ info: { version: "5.1.4" } })));
    expect(await fetchLatestVersion("pypi", "django")).toEqual({ latest: "5.1.4", outcome: "ok" });
  });

  it("maps 404 to not-found and other failures to error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 404)));
    expect((await fetchLatestVersion("npm", "nope")).outcome).toBe("not-found");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 500)));
    expect((await fetchLatestVersion("npm", "x")).outcome).toBe("error");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json", { status: 200 })));
    expect((await fetchLatestVersion("npm", "x")).outcome).toBe("error");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ version: 3 })));
    expect((await fetchLatestVersion("npm", "x")).outcome).toBe("error");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError")));
    expect(await fetchLatestVersion("pypi", "x")).toEqual({ latest: null, outcome: "error" });
  });

  it("skips invalid names without a request and passes a signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ version: "1.0.0" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchLatestVersion("npm", "../../x")).toEqual({ latest: null, outcome: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
    await fetchLatestVersion("npm", "react");
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});

describe("lookupLatestVersions", () => {
  it("keeps manifest order, skips non-registry specs and never exceeds 4 in flight", async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      const name = decodeURIComponent(url.split("/")[3]);
      return name === "missing" ? json({}, 404) : json({ version: `${name.length}.0.0` });
    });
    vi.stubGlobal("fetch", fetchMock);
    const packages = [
      ...Array.from({ length: 10 }, (_, i) => dep(`pkg${i}`)),
      dep("missing"),
      dep("local", "file:../local"),
      dep("bad name"),
    ];
    const evidence = await lookupLatestVersions("npm", packages);
    expect(evidence.registry).toBe("https://registry.npmjs.org/");
    expect(evidence.results.map((r) => r.name)).toEqual(packages.map((p) => p.name));
    expect(evidence.results[0]).toEqual({ name: "pkg0", latest: "4.0.0", outcome: "ok" });
    expect(evidence.results.slice(-3).map((r) => r.outcome)).toEqual(["not-found", "skipped", "skipped"]);
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("records outstanding packages as errors when the batch deadline passes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
          ),
      ),
    );
    const evidence = await lookupLatestVersions("pypi", [dep("a"), dep("b"), dep("c")], undefined, {
      batchTimeoutMs: 20,
      concurrency: 1,
    });
    expect(evidence.results.map((r) => r.outcome)).toEqual(["error", "error", "error"]);
  });

  it("stops starting requests once the caller cancels", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async () => {
      controller.abort();
      return json({ version: "1.0.0" });
    });
    vi.stubGlobal("fetch", fetchMock);
    const evidence = await lookupLatestVersions("npm", [dep("a"), dep("b"), dep("c")], controller.signal, {
      concurrency: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(evidence.results.map((r) => r.outcome)).toEqual(["ok", "error", "error"]);
  });

  it("handles an empty package list", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await lookupLatestVersions("npm", [])).results).toEqual([]);
  });
});
