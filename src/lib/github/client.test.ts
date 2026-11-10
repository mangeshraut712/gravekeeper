/**
 * Tests for src/lib/github/client.ts
 *
 * Uses vi.stubGlobal to replace globalThis.fetch with a mock so no real
 * network calls are made.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommits,
  fetchRepoMeta,
  parseGitHubUrl,
  createFork,
} from "./client";

// ---------------------------------------------------------------------------
// Helpers to build fake fetch responses
// ---------------------------------------------------------------------------

function okJson(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    headers: new Headers(
      status === 403 ? { "x-ratelimit-remaining": "0" } : {},
    ),
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Minimal GitHub API fixture data
// ---------------------------------------------------------------------------

const REPO_FIXTURE = {
  name: "gravekeeper",
  full_name: "ghost/gravekeeper",
  owner: { login: "ghost" },
  description: "Resurrect dead repositories",
  stargazers_count: 42,
  forks_count: 7,
  open_issues_count: 3,
  license: { spdx_id: "MIT", name: "MIT License" },
  default_branch: "main",
  pushed_at: "2021-06-15T10:00:00Z",
  archived: false,
  language: "TypeScript",
};

const ARCHIVED_REPO_FIXTURE = {
  ...REPO_FIXTURE,
  archived: true,
  language: null,
};

const COMMITS_FIXTURE = [
  {
    sha: "abc123",
    commit: {
      message: "Initial commit\n\nMore details here",
      author: { date: "2021-06-15T10:00:00Z", name: "Alice" },
    },
  },
  {
    sha: "def456",
    commit: {
      message: "Add tests",
      author: { date: "2021-06-14T09:00:00Z", name: "Bob" },
    },
  },
];

// ---------------------------------------------------------------------------
// parseGitHubUrl
// ---------------------------------------------------------------------------

describe("parseGitHubUrl", () => {
  it.each([
    "ftp://github.com/a/b",
    "https://user:pass@github.com/a/b",
    "https://github.com/a/b?token=x",
    "https://github.com/a/b%2Fc",
  ])("rejects unsafe repository URL %s", (url) => {
    expect(parseGitHubUrl(url)).toBeNull();
  });

  it("parses a standard HTTPS URL", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("strips trailing slash", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js/")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("strips .git suffix", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js.git")).toEqual({
      owner: "vercel",
      repo: "next.js",
    });
  });

  it("returns null for non-github URLs", () => {
    expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
  });

  it("returns null for a URL with only owner (no repo)", () => {
    expect(parseGitHubUrl("https://github.com/vercel")).toBeNull();
  });

  it("returns null for github.com root", () => {
    expect(parseGitHubUrl("https://github.com/")).toBeNull();
  });

  it("returns null for a URL with too many path segments", () => {
    expect(
      parseGitHubUrl("https://github.com/org/repo/blob/main/file.ts"),
    ).toBeNull();
  });

  it("returns null for an invalid URL string", () => {
    expect(parseGitHubUrl("not a url")).toBeNull();
  });

  it("handles http:// as well as https://", () => {
    expect(parseGitHubUrl("http://github.com/a/b")).toEqual({
      owner: "a",
      repo: "b",
    });
  });
});

// ---------------------------------------------------------------------------
// fetchRepoMeta
// ---------------------------------------------------------------------------

describe("fetchRepoMeta", () => {
  it("maps non-rate-limit 403 responses to a missing public repository", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ...errorResponse(403), headers: new Headers() }),
    );
    const result = await fetchRepoMeta("ghost", "gravekeeper");
    expect(result).toEqual({
      ok: false,
      code: "GITHUB_NOT_FOUND",
      error: "Public repository not found.",
    });
  });
  it("propagates request cancellation into metadata fetch", async () => {
    const controller = new AbortController();
    let captured: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url, init) => {
        captured = init.signal;
        return okJson(REPO_FIXTURE);
      }),
    );
    await fetchRepoMeta("ghost", "gravekeeper", controller.signal);
    controller.abort();
    expect(captured?.aborted).toBe(true);
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not expose private repositories accessible to the server token", async () => {
    vi.mocked(fetch).mockResolvedValue(
      okJson({ ...REPO_FIXTURE, private: true }),
    );
    const result = await fetchRepoMeta("ghost", "gravekeeper");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("GITHUB_NOT_FOUND");
  });

  it("uses identical errors for private and missing repositories", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJson({ ...REPO_FIXTURE, private: true }))
      .mockResolvedValueOnce(errorResponse(404));
    expect(await fetchRepoMeta("ghost", "gravekeeper")).toEqual(
      await fetchRepoMeta("ghost", "gravekeeper"),
    );
  });

  it("returns ok:true with mapped meta on a successful 200 response", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson(REPO_FIXTURE));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.owner).toBe("ghost");
    expect(result.data.repo).toBe("gravekeeper");
    expect(result.data.fullName).toBe("ghost/gravekeeper");
    expect(result.data.stars).toBe(42);
    expect(result.data.forks).toBe(7);
    expect(result.data.openIssues).toBe(3);
    expect(result.data.license).toBe("MIT");
    expect(result.data.defaultBranch).toBe("main");
    expect(result.data.pushedAt).toBe("2021-06-15T10:00:00Z");
    expect(result.data.archivedByGitHub).toBe(false);
    expect(result.data.language).toBe("TypeScript");
  });

  it("maps archivedByGitHub and null language for archived repos", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson(ARCHIVED_REPO_FIXTURE));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.archivedByGitHub).toBe(true);
    expect(result.data.language).toBeNull();
  });

  it("returns GITHUB_NOT_FOUND on 404", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(404));

    const result = await fetchRepoMeta("ghost", "nonexistent");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GITHUB_NOT_FOUND");
  });

  it("returns GITHUB_RATE_LIMIT on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(403));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GITHUB_RATE_LIMIT");
  });

  it("returns GITHUB_RATE_LIMIT on 429", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(429));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GITHUB_RATE_LIMIT");
  });

  it("returns HTTP_ERROR on other non-2xx status", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(500));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("HTTP_ERROR");
  });

  it("returns NETWORK_TIMEOUT on timeout (DOMException TimeoutError)", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK_TIMEOUT");
  });

  it("returns NETWORK_TIMEOUT on generic network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Failed to connect"));

    const result = await fetchRepoMeta("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK_TIMEOUT");
  });

  it("uses Accept and X-GitHub-Api-Version headers", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson(REPO_FIXTURE));

    await fetchRepoMeta("ghost", "gravekeeper");

    const [, options] = vi.mocked(fetch).mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });
});

// ---------------------------------------------------------------------------
// fetchCommits
// ---------------------------------------------------------------------------

describe("fetchCommits", () => {
  it.each([null, {}, [null], [{ commit: { message: null } }]])(
    "handles malformed commit data %j without throwing",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okJson(body)));
      const result = await fetchCommits("ghost", "gravekeeper");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("PARSE_ERROR");
    },
  );

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true with mapped commits on 200", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson(COMMITS_FIXTURE));

    const result = await fetchCommits("ghost", "gravekeeper");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);

    const [first, second] = result.data;
    expect(first.sha).toBe("abc123");
    // Only the first line of the message
    expect(first.message).toBe("Initial commit");
    expect(first.authorDate).toBe("2021-06-15T10:00:00Z");
    expect(first.authorName).toBe("Alice");

    expect(second.sha).toBe("def456");
    expect(second.message).toBe("Add tests");
  });

  it("returns empty array when repo has no commits", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson([]));

    const result = await fetchCommits("ghost", "empty-repo");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it("returns GITHUB_NOT_FOUND on 404", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(404));

    const result = await fetchCommits("ghost", "nonexistent");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GITHUB_NOT_FOUND");
  });

  it("returns GITHUB_RATE_LIMIT on 403", async () => {
    vi.mocked(fetch).mockResolvedValue(errorResponse(403));

    const result = await fetchCommits("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("GITHUB_RATE_LIMIT");
  });

  it("returns NETWORK_TIMEOUT on timeout", async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("timeout", "TimeoutError"),
    );

    const result = await fetchCommits("ghost", "gravekeeper");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("NETWORK_TIMEOUT");
  });

  it("includes per_page query param in URL", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson([]));

    await fetchCommits("ghost", "gravekeeper", 5);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("per_page=5");
  });

  it("defaults to per_page=20", async () => {
    vi.mocked(fetch).mockResolvedValue(okJson([]));

    await fetchCommits("ghost", "gravekeeper");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("per_page=20");
  });
});

// ---------------------------------------------------------------------------
// createFork
// ---------------------------------------------------------------------------

describe("createFork", () => {
  const ORIGINAL_TOKEN = process.env["GITHUB_TOKEN"];

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env["GITHUB_TOKEN"];
    } else {
      process.env["GITHUB_TOKEN"] = ORIGINAL_TOKEN;
    }
    vi.restoreAllMocks();
  });

  it("returns FORK_FAILED when GITHUB_TOKEN is unset", async () => {
    delete process.env["GITHUB_TOKEN"];
    const result = await createFork("owner", "repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORK_FAILED");
    }
  });

  it("returns forkUrl on success", async () => {
    process.env["GITHUB_TOKEN"] = "test-token";
    const body = { html_url: "https://github.com/me/repo" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: vi.fn().mockResolvedValue(JSON.stringify(body)),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createFork("owner", "repo");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.forkUrl).toBe("https://github.com/me/repo");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/repos/owner/repo/forks",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("maps 404 to GITHUB_NOT_FOUND", async () => {
    process.env["GITHUB_TOKEN"] = "test-token";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('{"message":"Not Found"}'),
      }),
    );
    const result = await createFork("missing", "repo");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("GITHUB_NOT_FOUND");
    }
  });
});
