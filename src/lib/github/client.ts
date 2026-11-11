/**
 * GitHub REST API v3 client.
 *
 * Fetches repository metadata and commit history using the public API.
 * Reads GITHUB_TOKEN from env when present; falls back to unauthenticated
 * requests (60 req/hr rate limit) when absent. Never hardcodes credentials.
 *
 * All functions return a typed Result<T> — never throw.
 */

import type { Commit, GitHubRepoMeta, ManifestPath, Result } from "@/types/index";
import { normalizePublicUrl, isGitHubRepository } from "@/shared/url";
import { sha256hex } from "@/lib/receipts/chain";

const GITHUB_API_BASE = "https://api.github.com";
const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the Authorization header when GITHUB_TOKEN env var is present. */
function authHeaders(): Record<string, string> {
  const token =
    typeof process !== "undefined" ? process.env["GITHUB_TOKEN"] : undefined;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/** Base headers for all GitHub API requests. */
function baseHeaders(): Record<string, string> {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...authHeaders(),
  };
}

/** Normalise a fetch-level error (timeout or network failure) to a Result. */
function fetchError(err: unknown): Result<never> {
  if (
    err instanceof DOMException &&
    (err.name === "TimeoutError" || err.name === "AbortError")
  ) {
    return {
      ok: false,
      error: "GitHub API request timed out after 10 seconds.",
      code: "NETWORK_TIMEOUT",
    };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Network error",
    code: "NETWORK_TIMEOUT",
  };
}

// ---------------------------------------------------------------------------
// parseGitHubUrl
// ---------------------------------------------------------------------------

/**
 * Parse a GitHub repository URL into its owner and repo components.
 *
 * Accepts:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo/
 *   - https://github.com/owner/repo.git
 *   - http://github.com/owner/repo
 *
 * Returns `null` for any URL that does not match the pattern.
 */
export function parseGitHubUrl(
  url: string,
): { owner: string; repo: string } | null {
  const normalized = normalizePublicUrl(url);
  if (!normalized) return null;
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com") {
    return null;
  }

  // pathname is like "/owner/repo" or "/owner/repo/" or "/owner/repo.git"
  const parts = parsed.pathname
    .replace(/\/$/, "")
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo || !isGitHubRepository(owner, repo)) {
    return null;
  }

  return { owner, repo };
}

// ---------------------------------------------------------------------------
// Raw GitHub API shapes (internal only)
// ---------------------------------------------------------------------------

type GitHubRepoApiResponse = {
  private?: boolean;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  license: { spdx_id: string | null; name: string | null } | null;
  default_branch: string;
  pushed_at: string;
  archived: boolean;
  language: string | null;
};

type GitHubCommitApiEntry = {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
      name: string;
    } | null;
  };
};

// ---------------------------------------------------------------------------
// fetchRepoMeta
// ---------------------------------------------------------------------------

/**
 * Fetch metadata for a GitHub repository.
 *
 * The returned `GitHubRepoMeta` matches the type in src/types/index.ts.
 * The raw GitHub `language` field is returned separately in the extended
 * object so the spec generator can use it without widening the shared type.
 *
 * @param owner - Repository owner login (e.g. "vercel").
 * @param repo  - Repository name (e.g. "next.js").
 */
export async function fetchRepoMeta(
  owner: string,
  repo: string,
  signal?: AbortSignal,
): Promise<Result<GitHubRepoMeta & { language: string | null }>> {
  const apiUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: baseHeaders(),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<
      GitHubRepoMeta & { language: string | null }
    >;
  }

  if (
    response.status === 404 ||
    (response.status === 403 &&
      response.headers?.get("x-ratelimit-remaining") !== "0" &&
      !response.headers?.get("retry-after"))
  ) {
    return {
      ok: false,
      error: "Public repository not found.",
      code: "GITHUB_NOT_FOUND",
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: "GitHub API rate limit exceeded. Please retry later.",
      code: "GITHUB_RATE_LIMIT",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub API returned HTTP ${response.status}`,
      code: "HTTP_ERROR",
    };
  }

  let body: GitHubRepoApiResponse;
  try {
    body = (await response.json()) as GitHubRepoApiResponse;
  } catch {
    return {
      ok: false,
      error: "Failed to parse GitHub API response as JSON.",
      code: "PARSE_ERROR",
    };
  }

  if (
    !body ||
    typeof body !== "object" ||
    typeof body.name !== "string" ||
    typeof body.full_name !== "string" ||
    typeof body.stargazers_count !== "number" ||
    typeof body.forks_count !== "number" ||
    typeof body.open_issues_count !== "number" ||
    typeof body.pushed_at !== "string" ||
    typeof body.default_branch !== "string" ||
    typeof body.archived !== "boolean" ||
    (body.description !== null && typeof body.description !== "string") ||
    (body.language !== null && typeof body.language !== "string")
  ) {
    return {
      ok: false,
      error: "Invalid GitHub metadata response.",
      code: "PARSE_ERROR",
    };
  }

  if (body.private) {
    return {
      ok: false,
      error: "Public repository not found.",
      code: "GITHUB_NOT_FOUND",
    };
  }

  const meta: GitHubRepoMeta & { language: string | null } = {
    owner,
    repo: body.name,
    fullName: body.full_name,
    description: body.description,
    stars: body.stargazers_count,
    forks: body.forks_count,
    openIssues: body.open_issues_count,
    license: body.license?.spdx_id ?? body.license?.name ?? null,
    defaultBranch: body.default_branch,
    pushedAt: body.pushed_at,
    archivedByGitHub: body.archived,
    language: body.language,
  };

  return { ok: true, data: meta };
}

// ---------------------------------------------------------------------------
// fetchCommits
// ---------------------------------------------------------------------------

/**
 * Fetch the most recent commits for a GitHub repository.
 *
 * @param owner   - Repository owner login.
 * @param repo    - Repository name.
 * @param perPage - Number of commits to fetch (default 20, max 100).
 */
export async function fetchCommits(
  owner: string,
  repo: string,
  perPage = 20,
  signal?: AbortSignal,
): Promise<Result<Commit[]>> {
  const apiUrl =
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits` +
    `?per_page=${perPage}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: baseHeaders(),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
        : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<Commit[]>;
  }

  if (
    response.status === 404 ||
    (response.status === 403 &&
      response.headers?.get("x-ratelimit-remaining") !== "0" &&
      !response.headers?.get("retry-after"))
  ) {
    return {
      ok: false,
      error: "Public repository not found.",
      code: "GITHUB_NOT_FOUND",
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: "GitHub API rate limit exceeded.",
      code: "GITHUB_RATE_LIMIT",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub API returned HTTP ${response.status}`,
      code: "HTTP_ERROR",
    };
  }

  let body: GitHubCommitApiEntry[];
  try {
    body = (await response.json()) as GitHubCommitApiEntry[];
  } catch {
    return {
      ok: false,
      error: "Failed to parse GitHub commits response as JSON.",
      code: "PARSE_ERROR",
    };
  }

  if (
    !Array.isArray(body) ||
    !body.every(
      (entry) =>
        entry &&
        typeof entry.sha === "string" &&
        entry.commit &&
        typeof entry.commit.message === "string" &&
        (entry.commit.author === null ||
          (entry.commit.author &&
            typeof entry.commit.author.date === "string" &&
            typeof entry.commit.author.name === "string")),
    )
  ) {
    return {
      ok: false,
      error: "Invalid GitHub commits response.",
      code: "PARSE_ERROR",
    };
  }
  const commits: Commit[] = body.map((entry) => ({
    sha: entry.sha,
    // Only take the first line of the commit message
    message: entry.commit.message.split("\n")[0] ?? "",
    authorDate: entry.commit.author?.date ?? "",
    authorName: entry.commit.author?.name ?? "Unknown",
  }));

  return { ok: true, data: commits };
}

// ---------------------------------------------------------------------------
// fetchRootManifest
// ---------------------------------------------------------------------------

export const MANIFEST_PATHS: readonly ManifestPath[] = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
];
export const MAX_MANIFEST_BYTES = 512 * 1024;

export type RootManifest = {
  path: ManifestPath;
  url: string;
  text: string;
  rawSha256: string;
};

function isRateLimited(response: Response): boolean {
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers?.get("x-ratelimit-remaining") === "0" ||
        Boolean(response.headers?.get("retry-after"))))
  );
}

/** Base URL of the contents API for a repository (used as the receipt URL when no manifest is found). */
export function contentsUrl(owner: string, repo: string): string {
  return `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;
}

/**
 * Read at most `limit` bytes of a response body. Returns null (and cancels the
 * stream) as soon as the body passes the limit, so a body without a usable
 * content-length is never buffered in full. Throws only what the stream throws.
 */
async function readCapped(response: Response, limit: number): Promise<Uint8Array | null> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > limit ? null : bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Read the first root manifest found on the default branch, in the order
 * package.json, requirements.txt, pyproject.toml, via the raw contents API.
 */
export async function fetchRootManifest(
  owner: string,
  repo: string,
  branch: string,
  signal?: AbortSignal,
): Promise<Result<RootManifest>> {
  // One deadline for every probe so a missing manifest costs at most TIMEOUT_MS in total.
  const deadline = AbortSignal.timeout(TIMEOUT_MS);
  const probeSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  for (const path of MANIFEST_PATHS) {
    const url = `${contentsUrl(owner, repo)}/${path}?ref=${encodeURIComponent(branch)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { ...baseHeaders(), Accept: "application/vnd.github.raw+json" },
        signal: probeSignal,
      });
    } catch (err) {
      return fetchError(err) as Result<RootManifest>;
    }
    if (response.status === 404) continue;
    if (isRateLimited(response))
      return {
        ok: false,
        error: "GitHub API rate limit exceeded.",
        code: "GITHUB_RATE_LIMIT",
      };
    if (!response.ok)
      return {
        ok: false,
        error: `GitHub API returned HTTP ${response.status}`,
        code: "HTTP_ERROR",
      };
    const declared = Number(response.headers?.get("content-length") ?? 0);
    if (declared > MAX_MANIFEST_BYTES)
      return { ok: false, error: `${path} is larger than 512 KiB.`, code: "PARSE_ERROR" };
    let bytes: Uint8Array | null;
    try {
      bytes = await readCapped(response, MAX_MANIFEST_BYTES);
    } catch (err) {
      if (err instanceof DOMException) return fetchError(err) as Result<RootManifest>;
      return { ok: false, error: `Failed to read ${path}.`, code: "PARSE_ERROR" };
    }
    if (bytes === null)
      return { ok: false, error: `${path} is larger than 512 KiB.`, code: "PARSE_ERROR" };
    return {
      ok: true,
      data: {
        path,
        url,
        text: new TextDecoder().decode(bytes),
        rawSha256: await sha256hex(bytes),
      },
    };
  }
  return {
    ok: false,
    error: "No package.json, requirements.txt or pyproject.toml at the repository root.",
    code: "MANIFEST_NOT_FOUND",
  };
}

// ---------------------------------------------------------------------------
// createFork
// ---------------------------------------------------------------------------

/**
 * Create a fork of a GitHub repository for the authenticated user.
 *
 * Requires `GITHUB_TOKEN` in the environment. Returns `FORK_FAILED` when the
 * token is missing or the GitHub API rejects the request.
 *
 * @param owner - Upstream repository owner login.
 * @param repo  - Upstream repository name.
 */
export async function createFork(
  owner: string,
  repo: string,
): Promise<Result<{ forkUrl: string; rawBody: string }>> {
  const token =
    typeof process !== "undefined" ? process.env["GITHUB_TOKEN"] : undefined;
  if (!token) {
    return {
      ok: false,
      error: "GITHUB_TOKEN is not set. Fork creation requires authentication.",
      code: "FORK_FAILED",
    };
  }

  const apiUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/forks`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: baseHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<{ forkUrl: string; rawBody: string }>;
  }

  let rawBody = "";
  try {
    rawBody = await response.text();
  } catch {
    return {
      ok: false,
      error: "Failed to read GitHub fork response body.",
      code: "PARSE_ERROR",
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: "Public repository not found.",
      code: "GITHUB_NOT_FOUND",
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: "GitHub API rate limit or permission error while forking.",
      code: "GITHUB_RATE_LIMIT",
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub fork API returned HTTP ${response.status}: ${rawBody.slice(0, 200)}`,
      code: "FORK_FAILED",
    };
  }

  let body: { html_url?: string };
  try {
    body = JSON.parse(rawBody) as { html_url?: string };
  } catch {
    return {
      ok: false,
      error: "Failed to parse GitHub fork response as JSON.",
      code: "PARSE_ERROR",
    };
  }

  if (!body.html_url) {
    return {
      ok: false,
      error: "GitHub fork response did not include html_url.",
      code: "FORK_FAILED",
    };
  }

  return { ok: true, data: { forkUrl: body.html_url, rawBody } };
}
