/**
 * Unit tests for POST /api/fork with mocked fetch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";
import { verifyChain } from "@/lib/receipts/chain";

function jsonRequest(
  body: unknown,
  authorization = "Bearer test-admin-secret-long-enough-for-tests",
): NextRequest {
  return new NextRequest("http://localhost/api/fork", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}

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

describe("POST /api/fork", () => {
  const ORIGINAL_TOKEN = process.env["GITHUB_TOKEN"];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("FORK_API_SECRET", "test-admin-secret-long-enough-for-tests");
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env["GITHUB_TOKEN"];
    } else {
      process.env["GITHUB_TOKEN"] = ORIGINAL_TOKEN;
    }
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables writes by default even when a GitHub token exists", async () => {
    vi.stubEnv("FORK_API_SECRET", "");
    process.env.GITHUB_TOKEN = "tok";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(jsonRequest({ owner: "a", repo: "b" }));
    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "",
    "Bearer wrong",
    "Basic test-admin-secret-long-enough-for-tests",
  ])("rejects unauthorized writes (%s)", async (authorization) => {
    process.env.GITHUB_TOKEN = "tok";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(
      jsonRequest({ owner: "a", repo: "b" }, authorization),
    );
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["../victim", ".", "..", "a/b", "repo?x=1", "a%2fb"])(
    "rejects malformed repository name %s",
    async (repo) => {
      process.env.GITHUB_TOKEN = "tok";
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const res = await POST(jsonRequest({ owner: "a", repo }));
      expect(res.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("does not call GitHub when key generation fails", async () => {
    process.env.GITHUB_TOKEN = "tok";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(crypto.subtle, "generateKey").mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    const res = await POST(jsonRequest({ owner: "a", repo: "b" }));
    expect(res.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves the accepted fork URL if signing fails after GitHub accepts it", async () => {
    process.env.GITHUB_TOKEN = "tok";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 202,
          text: async () =>
            JSON.stringify({ html_url: "https://github.com/me/b" }),
        }),
    );
    vi.spyOn(crypto.subtle, "sign").mockRejectedValueOnce(
      new Error("Unavailable"),
    );
    const res = await POST(jsonRequest({ owner: "a", repo: "b" }));
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      forkUrl: "https://github.com/me/b",
      receipt: null,
    });
  });

  it("returns 400 when owner/repo missing", async () => {
    process.env["GITHUB_TOKEN"] = "tok";
    const res = await POST(jsonRequest({ owner: "a" }));
    expect(res.status).toBe(400);
  });

  it("returns 503 when GITHUB_TOKEN is unset", async () => {
    delete process.env["GITHUB_TOKEN"];
    const res = await POST(jsonRequest({ owner: "a", repo: "b" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("FORK_FAILED");
  });

  it("returns forkUrl and a verifiable fork receipt on success", async () => {
    process.env["GITHUB_TOKEN"] = "tok";
    const forkBody = { html_url: "https://github.com/me/gravekeeper" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 202,
        text: async () => JSON.stringify(forkBody),
      }),
    );

    const res = await POST(
      jsonRequest({ owner: "ghost", repo: "gravekeeper" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.forkUrl).toBe("https://github.com/me/gravekeeper");
    expect(body.receipt.kind).toBe("fork");

    const pk = await importPublicKey(body.publicKey);
    const verified = await verifyChain([body.receipt], pk);
    expect(verified.valid).toBe(true);
  });

  it("surfaces FORK_FAILED when GitHub rejects the fork", async () => {
    process.env["GITHUB_TOKEN"] = "tok";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"message":"bad request"}',
      }),
    );
    const res = await POST(
      jsonRequest({ owner: "ghost", repo: "gravekeeper" }),
    );
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("FORK_FAILED");
  });
});
