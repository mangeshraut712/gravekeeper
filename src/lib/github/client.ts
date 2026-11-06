/**
 * GitHub REST API v3 client.
 *
 * Fetches repository metadata and commit history using the public API.
 * Reads GITHUB_TOKEN from env when present; falls back to unauthenticated
 * requests (60 req/hr rate limit) when absent. Never hardcodes credentials.
 *
 * All functions return a typed Result<T> — never throw.
 */

import type { Commit, GitHubRepoMeta, Result } from '@/types/index';

const GITHUB_API_BASE = 'https://api.github.com';
const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the Authorization header when GITHUB_TOKEN env var is present. */
function authHeaders(): Record<string, string> {
  const token =
    typeof process !== 'undefined' ? process.env['GITHUB_TOKEN'] : undefined;
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/** Base headers for all GitHub API requests. */
function baseHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...authHeaders(),
  };
}

/** Normalise a fetch-level error (timeout or network failure) to a Result. */
function fetchError(err: unknown): Result<never> {
  if (
    err instanceof DOMException &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  ) {
    return {
      ok: false,
      error: 'GitHub API request timed out after 10 seconds.',
      code: 'NETWORK_TIMEOUT',
    };
  }
  return {
    ok: false,
    error: err instanceof Error ? err.message : 'Network error',
    code: 'NETWORK_TIMEOUT',
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
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== 'github.com') {
    return null;
  }

  // pathname is like "/owner/repo" or "/owner/repo/" or "/owner/repo.git"
  const parts = parsed.pathname
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  const [owner, repo] = parts;
  if (!owner || !repo) {
    return null;
  }

  return { owner, repo };
}

// ---------------------------------------------------------------------------
// Raw GitHub API shapes (internal only)
// ---------------------------------------------------------------------------

type GitHubRepoApiResponse = {
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
): Promise<Result<GitHubRepoMeta & { language: string | null }>> {
  const apiUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: baseHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<GitHubRepoMeta & { language: string | null }>;
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `Repository ${owner}/${repo} not found on GitHub.`,
      code: 'GITHUB_NOT_FOUND',
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: 'GitHub API rate limit exceeded. Provide a GITHUB_TOKEN to raise the limit.',
      code: 'GITHUB_RATE_LIMIT',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub API returned HTTP ${response.status}`,
      code: 'HTTP_ERROR',
    };
  }

  let body: GitHubRepoApiResponse;
  try {
    body = (await response.json()) as GitHubRepoApiResponse;
  } catch {
    return {
      ok: false,
      error: 'Failed to parse GitHub API response as JSON.',
      code: 'PARSE_ERROR',
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
): Promise<Result<Commit[]>> {
  const apiUrl =
    `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits` +
    `?per_page=${perPage}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: baseHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<Commit[]>;
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `Repository ${owner}/${repo} not found on GitHub.`,
      code: 'GITHUB_NOT_FOUND',
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: 'GitHub API rate limit exceeded.',
      code: 'GITHUB_RATE_LIMIT',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub API returned HTTP ${response.status}`,
      code: 'HTTP_ERROR',
    };
  }

  let body: GitHubCommitApiEntry[];
  try {
    body = (await response.json()) as GitHubCommitApiEntry[];
  } catch {
    return {
      ok: false,
      error: 'Failed to parse GitHub commits response as JSON.',
      code: 'PARSE_ERROR',
    };
  }

  const commits: Commit[] = body.map((entry) => ({
    sha: entry.sha,
    // Only take the first line of the commit message
    message: entry.commit.message.split('\n')[0] ?? '',
    authorDate: entry.commit.author?.date ?? '',
    authorName: entry.commit.author?.name ?? 'Unknown',
  }));

  return { ok: true, data: commits };
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
    typeof process !== 'undefined' ? process.env['GITHUB_TOKEN'] : undefined;
  if (!token) {
    return {
      ok: false,
      error: 'GITHUB_TOKEN is not set. Fork creation requires authentication.',
      code: 'FORK_FAILED',
    };
  }

  const apiUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/forks`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: baseHeaders(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return fetchError(err) as Result<{ forkUrl: string; rawBody: string }>;
  }

  let rawBody = '';
  try {
    rawBody = await response.text();
  } catch {
    return {
      ok: false,
      error: 'Failed to read GitHub fork response body.',
      code: 'PARSE_ERROR',
    };
  }

  if (response.status === 404) {
    return {
      ok: false,
      error: `Repository ${owner}/${repo} not found on GitHub.`,
      code: 'GITHUB_NOT_FOUND',
    };
  }

  if (response.status === 403 || response.status === 429) {
    return {
      ok: false,
      error: 'GitHub API rate limit or permission error while forking.',
      code: 'GITHUB_RATE_LIMIT',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `GitHub fork API returned HTTP ${response.status}: ${rawBody.slice(0, 200)}`,
      code: 'FORK_FAILED',
    };
  }

  let body: { html_url?: string };
  try {
    body = JSON.parse(rawBody) as { html_url?: string };
  } catch {
    return {
      ok: false,
      error: 'Failed to parse GitHub fork response as JSON.',
      code: 'PARSE_ERROR',
    };
  }

  if (!body.html_url) {
    return {
      ok: false,
      error: 'GitHub fork response did not include html_url.',
      code: 'FORK_FAILED',
    };
  }

  return { ok: true, data: { forkUrl: body.html_url, rawBody } };
}
