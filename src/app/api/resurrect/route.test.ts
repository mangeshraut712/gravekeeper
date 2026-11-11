/**
 * Integration-style unit tests for POST /api/resurrect.
 * All upstream HTTP is mocked via vi.stubGlobal('fetch').
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { verifyChain } from "@/lib/receipts/chain";
import { verifyProof } from "@/client/proof";
import fc from "fast-check";

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/resurrect", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function waybackOk(url: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url,
      archived_snapshots: {
        closest: {
          status: "200",
          available: true,
          url: `https://web.archive.org/web/20231015120000/${url}`,
          timestamp: "20231015120000",
        },
      },
    }),
  };
}

function waybackMiss(url: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url,
      archived_snapshots: {},
    }),
  };
}

function githubMetaOk() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      name: "gravekeeper",
      full_name: "ghost/gravekeeper",
      owner: { login: "ghost" },
      description: "haunted",
      stargazers_count: 3,
      forks_count: 1,
      open_issues_count: 0,
      license: { spdx_id: "MIT", name: "MIT" },
      default_branch: "main",
      pushed_at: "2020-01-01T00:00:00Z",
      archived: true,
      language: "TypeScript",
    }),
  };
}

function githubCommitsOk() {
  return {
    ok: true,
    status: 200,
    json: async () => [
      {
        sha: "abc123",
        commit: {
          message: "initial commit\n\nbody",
          author: { date: "2020-01-01T00:00:00Z", name: "Ghost" },
        },
      },
    ],
  };
}

function cdxOk() {
  return new Response(
    '[["timestamp","statuscode"],["20140622190015","301"],["20260101000000","200"]]',
    { status: 200 },
  );
}

function notFound() {
  return new Response("Not Found", { status: 404 });
}

/** Import raw public key bytes from base64url for verifyChain. */
async function importPublicKey(b64url: string): Promise<CryptoKey> {
  const b64 = b64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(b64url.length + ((4 - (b64url.length % 4)) % 4), "=");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return crypto.subtle.importKey("raw", bytes, { name: "Ed25519" }, true, [
    "verify",
  ]);
}

describe("POST /api/resurrect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    "javascript:alert(1)",
    "file:///etc/passwd",
    "ftp://example.com",
    "not-a-url",
    "https://user:password@example.com",
    "http://localhost/private",
    "http://127.0.0.1",
    "http://192.168.1.2",
    "http://[::1]",
    "https://example.com/?token=secret",
  ])(
    "rejects unsafe or credential-bearing URL %s before network access",
    async (url) => {
      const fetchMock = vi.fn().mockResolvedValue(waybackMiss(url));
      vi.stubGlobal("fetch", fetchMock);
      const res = await POST(jsonRequest({ url }));
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not start commit lookups after cancellation", async () => {
    const controller = new AbortController();
    const request = new NextRequest("http://localhost/api/resurrect", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/ghost/gravekeeper" }),
      signal: controller.signal,
    });
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url) => {
        calls.push(String(url));
        controller.abort();
        return String(url).includes("archive.org")
          ? waybackMiss("https://github.com/ghost/gravekeeper")
          : githubMetaOk();
      }),
    );
    expect((await POST(request)).status).toBe(499);
    expect(calls.some((url) => url.includes("/commits"))).toBe(false);
  });
  it("returns 400 when url is missing", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("PARSE_ERROR");
  });

  it("returns 400 when url is empty", async () => {
    const res = await POST(jsonRequest({ url: "   " }));
    expect(res.status).toBe(400);
  });

  it("returns wayback-only response for a non-GitHub URL", async () => {
    const url = "https://example.com/dead";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(waybackOk(url)));

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.github).toBeNull();
    expect(body.spec).toBeNull();
    expect(body.wayback?.available).toBe(true);
    expect(body.receipts[0].kind).toBe("wayback");
    expect(typeof body.publicKey).toBe("string");

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain(body.receipts, pk);
    expect(verified.valid).toBe(true);
    expect(await verifyProof(body)).toBe(true);
  });

  it("records wayback-miss and continues when no snapshot exists", async () => {
    const url = "https://example.com/never-archived";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(waybackMiss(url)));

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wayback).toBeNull();
    expect(body.receipts[0].kind).toBe("wayback-miss");
    expect(await verifyProof(body)).toBe(true);
  });

  it("builds a full GitHub resurrection chain with a valid receipt chain", async () => {
    const url = "https://github.com/ghost/gravekeeper";
    const fetchMock = vi.fn().mockImplementation(async (req: string | URL) => {
      const href = String(req);
      if (href.includes("web.archive.org/cdx/")) return cdxOk();
      if (href.includes("archive.org")) return waybackOk(url);
      if (href.includes("/contents/")) return notFound();
      if (href.includes("/commits")) return githubCommitsOk();
      if (href.includes("/repos/")) return githubMetaOk();
      throw new Error(`unexpected fetch: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.github?.meta.fullName).toBe("ghost/gravekeeper");
    expect(body.spec?.revivalSteps.length).toBeGreaterThanOrEqual(3);
    expect(body.evidence).toHaveLength(body.receipts.length);
    expect(body.evidence[1].body).toEqual({
      limit: 1200,
      timestamps: ["20140622190015", "20260101000000"],
    });
    expect(body.evidence[2].body).toEqual(body.github.meta);
    expect(body.evidence[4].body).toEqual({ code: "MANIFEST_NOT_FOUND" });
    expect(body.evidence[5].body).toEqual(body.spec);
    expect(body.timeline).toMatchObject({ state: "complete", yearsOnRecord: 13, capturedMonths: 2 });
    expect(body.autopsy.state).toBe("no-manifest");
    expect(body.receipts.map((r: { kind: string }) => r.kind)).toEqual([
      "wayback",
      "wayback-cdx",
      "github-meta",
      "github-commits",
      "github-manifest",
      "spec",
    ]);

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain(body.receipts, pk);
    expect(verified.valid).toBe(true);
    expect(await verifyProof(body)).toBe(true);
  });

  it("property: successful GitHub resurrect always yields a verifiable receipt chain", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,11}[a-z0-9]$/),
        fc.stringMatching(/^[a-z][a-z0-9-]{0,11}[a-z0-9]$/),
        async (owner, repo) => {
          const url = `https://github.com/${owner}/${repo}`;
          vi.stubGlobal(
            "fetch",
            vi.fn().mockImplementation(async (req: string | URL) => {
              const href = String(req);
              if (href.includes("archive.org")) return waybackOk(url);
              if (href.includes("/contents/")) return notFound();
              if (href.includes("/commits")) return githubCommitsOk();
              if (href.includes("/repos/")) {
                const base = await githubMetaOk();
                const json = await base.json();
                return {
                  ...base,
                  json: async () => ({
                    ...json,
                    name: repo,
                    full_name: `${owner}/${repo}`,
                    owner: { login: owner },
                  }),
                };
              }
              throw new Error(`unexpected fetch: ${href}`);
            }),
          );

          const res = await POST(jsonRequest({ url }));
          expect(res.status).toBe(200);
          const body = await res.json();
          const pk = await importPublicKey(body.publicKey);
          const verified = await verifyChain(body.receipts, pk);
          expect(verified.valid).toBe(true);
          expect(await verifyProof(body)).toBe(true);
          expect(body.receipts.length).toBeGreaterThanOrEqual(6);
        },
      ),
      { numRuns: 15 },
    );
  });

  describe("dependency autopsy", () => {
    const repoUrl = "https://github.com/ghost/gravekeeper";

    function routeFetch(handlers: {
      manifest?: Record<string, string>;
      registry?: (href: string, init?: RequestInit) => Promise<Response> | Response;
    }) {
      return vi.fn().mockImplementation(async (req: string | URL, init?: RequestInit) => {
        const href = String(req);
        if (href.includes("archive.org")) return waybackMiss(repoUrl);
        if (href.includes("/contents/")) {
          const file = href.split("/contents/")[1].split("?")[0];
          const text = handlers.manifest?.[file];
          return text === undefined ? notFound() : new Response(text, { status: 200 });
        }
        if (href.includes("/commits")) return githubCommitsOk();
        if (href.includes("api.github.com/repos/")) return githubMetaOk();
        if (href.includes("registry.npmjs.org") || href.includes("pypi.org"))
          return handlers.registry!(href, init);
        throw new Error(`unexpected fetch: ${href}`);
      });
    }

    it("reads package.json, looks up npm and binds the autopsy into the proof", async () => {
      const latest: Record<string, string> = { react: "19.2.0", lodash: "4.17.21", "@types/node": "22.0.0" };
      const fetchMock = routeFetch({
        manifest: {
          "package.json": JSON.stringify({
            dependencies: { react: "^16.14.0", lodash: "^4.17.0" },
            devDependencies: { "@types/node": "^22.0.0", "ghost-pkg": "^1.0.0", local: "file:../x" },
          }),
        },
        registry: (href) => {
          const name = decodeURIComponent(href.split("registry.npmjs.org/")[1].replace("/latest", ""));
          return latest[name]
            ? new Response(JSON.stringify({ version: latest[name] }), { status: 200 })
            : notFound();
        },
      });
      vi.stubGlobal("fetch", fetchMock);
      const body = await (await POST(jsonRequest({ url: repoUrl }))).json();
      expect(body.receipts.map((r: { kind: string }) => r.kind)).toEqual([
        "wayback-miss",
        "wayback-cdx",
        "github-meta",
        "github-commits",
        "github-manifest",
        "registry",
        "spec",
      ]);
      expect(body.receipts[4].url).toBe(
        "https://api.github.com/repos/ghost/gravekeeper/contents/package.json?ref=main",
      );
      expect(body.receipts[5].url).toBe("https://registry.npmjs.org/");
      expect(body.autopsy.state).toBe("complete");
      expect(body.autopsy.counts).toEqual({
        current: 1,
        "minor-behind": 1,
        "major-behind": 1,
        unknown: 1,
        "not-found": 1,
      });
      expect(body.spec.revivalSteps.map((s: { title: string }) => s.title)).toContain(
        "Upgrade react ^16.14.0 → 19.x (major behind)",
      );
      expect(body.spec.detectedFramework).toBe("React");
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/local/"))).toBe(false);
      expect(await verifyProof(body, repoUrl)).toBe(true);
      body.autopsy.dependencies[0].status = "current";
      expect(await verifyProof(body, repoUrl)).toBe(false);
    });

    it("falls back to requirements.txt and PyPI", async () => {
      vi.stubGlobal(
        "fetch",
        routeFetch({
          manifest: { "requirements.txt": "Django==2.2.0\nrequests>=2.31\n-r dev.txt\n" },
          registry: (href) =>
            new Response(
              JSON.stringify({ info: { version: href.includes("/django/") ? "5.1.4" : "2.32.3" } }),
              { status: 200 },
            ),
        }),
      );
      const body = await (await POST(jsonRequest({ url: repoUrl }))).json();
      expect(body.autopsy.manifest).toMatchObject({ path: "requirements.txt", ecosystem: "pypi", skippedLines: 1 });
      expect(body.autopsy.dependencies.map((d: { status: string }) => d.status)).toEqual([
        "major-behind",
        "minor-behind",
      ]);
      expect(await verifyProof(body, repoUrl)).toBe(true);
    });

    it("labels a registry outage as partial and keeps a verifiable proof", async () => {
      vi.stubGlobal(
        "fetch",
        routeFetch({
          manifest: { "package.json": JSON.stringify({ dependencies: { react: "^16.0.0" } }) },
          registry: () => new Response("", { status: 503 }),
        }),
      );
      const res = await POST(jsonRequest({ url: repoUrl }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.autopsy.state).toBe("partial");
      expect(body.autopsy.dependencies[0]).toMatchObject({ status: "unknown", note: "Registry lookup failed." });
      expect(JSON.stringify(body.spec.revivalSteps)).toMatch(/partial/);
      expect(await verifyProof(body, repoUrl)).toBe(true);
    });

    it("records an unreadable manifest and keeps the metadata-only plan", async () => {
      vi.stubGlobal("fetch", routeFetch({ manifest: { "package.json": "{not json" } }));
      const body = await (await POST(jsonRequest({ url: repoUrl }))).json();
      expect(body.evidence[4].body).toEqual({ code: "PARSE_ERROR" });
      expect(body.autopsy.state).toBe("unavailable");
      expect(body.receipts.map((r: { kind: string }) => r.kind)).not.toContain("registry");
      expect(body.spec.revivalSteps.map((s: { title: string }) => s.title)).toContain(
        "Audit and update dependencies (metadata only)",
      );
      expect(await verifyProof(body, repoUrl)).toBe(true);
    });

    it("keeps a verifiable proof when a spec exceeds the evidence limit", async () => {
      const longRange = Array.from({ length: 40 }, (_, i) => `^${i}.0.0`).join(" || ");
      vi.stubGlobal(
        "fetch",
        routeFetch({
          manifest: {
            "package.json": JSON.stringify({ dependencies: { react: ">=15.0.0 >=16.0.0", huge: longRange } }),
          },
          registry: () => new Response(JSON.stringify({ version: "16.2.0" }), { status: 200 }),
        }),
      );
      const body = await (await POST(jsonRequest({ url: repoUrl }))).json();
      expect(body.autopsy).not.toBeNull();
      expect(body.autopsy.manifest.skippedLines).toBe(1);
      expect(body.autopsy.dependencies).toMatchObject([{ name: "react", floor: "16.0.0", status: "minor-behind" }]);
      expect(await verifyProof(body, repoUrl)).toBe(true);
    });

    it("returns 499 when canceled during registry lookups", async () => {
      const controller = new AbortController();
      const request = new NextRequest("http://localhost/api/resurrect", {
        method: "POST",
        body: JSON.stringify({ url: repoUrl }),
        signal: controller.signal,
      });
      let registryCalls = 0;
      vi.stubGlobal(
        "fetch",
        routeFetch({
          manifest: {
            "package.json": JSON.stringify({ dependencies: { a: "1", b: "1", c: "1", d: "1", e: "1", f: "1" } }),
          },
          registry: () => {
            registryCalls++;
            controller.abort();
            return new Response(JSON.stringify({ version: "1.0.0" }), { status: 200 });
          },
        }),
      );
      expect((await POST(request)).status).toBe(499);
      expect(registryCalls).toBeLessThanOrEqual(4);
    });
  });
});

describe("POST /api/resurrect epitaph timeline", () => {
  afterEach(() => vi.unstubAllGlobals());
  const url = "http://www.geocities.com/";

  function stub(cdx: () => Response | Promise<Response>) {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (req: string | URL) => {
        const href = String(req);
        calls.push(href);
        if (href.includes("web.archive.org/cdx/")) return cdx();
        if (href.includes("archive.org")) return waybackOk(url);
        throw new Error(`unexpected fetch: ${href}`);
      }),
    );
    return calls;
  }

  it("records the capture index as the second receipt and binds the timeline", async () => {
    const calls = stub(cdxOk);
    const body = await (await POST(jsonRequest({ url }))).json();
    expect(body.receipts.map((r: { kind: string }) => r.kind)).toEqual(["wayback", "wayback-cdx"]);
    expect(body.receipts[1].url).toBe(
      "https://web.archive.org/cdx/search/cdx?url=http%3A%2F%2Fwww.geocities.com%2F&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=1200&matchType=exact",
    );
    expect(calls).toContain(body.receipts[1].url);
    expect(body.timeline.firstCapture).toBe("20140622190015");
    expect(body.timeline.lastSeen).toBe("20260101000000");
    expect(await verifyProof(body, url)).toBe(true);
  });

  it("returns an empty timeline when the index has no captures", async () => {
    stub(() => new Response("[]", { status: 200 }));
    const body = await (await POST(jsonRequest({ url }))).json();
    expect(body.timeline.state).toBe("empty");
    expect(await verifyProof(body, url)).toBe(true);
  });

  it.each([
    ["HTTP_ERROR", () => new Response("busy", { status: 503 })],
    ["PARSE_ERROR", () => new Response("<html>", { status: 200 })],
    ["NETWORK_TIMEOUT", () => Promise.reject(new DOMException("t", "TimeoutError"))],
  ])("keeps the lookup and records %s when CDX fails", async (code, cdx) => {
    stub(cdx as () => Promise<Response>);
    const res = await POST(jsonRequest({ url }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wayback.available).toBe(true);
    expect(body.evidence[1].body).toEqual({ code });
    expect(body.timeline).toMatchObject({ state: "unavailable", code });
    expect(await verifyProof(body, url)).toBe(true);
  });
});
