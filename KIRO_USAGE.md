# How Kiro was used to build Gravekeeper

A running log for the Kiroween write-up. Newest entries at the bottom.

## Week 1 (Nov 3, 2026)

### Steering (`.kiro/steering/`)
- Kiro CLI wrote `product.md`, `tech.md` and `structure.md` from a one-paragraph product pitch.
- It read the installed packages and pinned the real versions (Next.js 16, Tailwind v4, Vitest, fast-check) in `tech.md` instead of the version I guessed in the prompt.
- Every later Kiro session starts with "follow .kiro/steering", so module layout and conventions stay the same across sessions.

### Spec-driven development (`.kiro/specs/resurrect/`)
- `requirements.md`: 7 user stories with numbered EARS acceptance criteria.
- `design.md`: architecture, data models (including the hash-chained `Receipt`), canonical JSON hashing, six correctness properties written to be checked by property-based tests, and a `Result<T>` error model.
- `tasks.md`: 17 tasks in 4 phases, each one linked to the requirements it covers.
- Then Kiro worked through the tasks one at a time:
  - Tasks 1–3: shared types, Ed25519 receipt signing, and the SHA-256 receipt chain. The fast-check property tests cover all six design properties. I fixed a few TypeScript typing issues by hand after Kiro's session was throttled.
  - Task 4: Wayback Machine availability client with mocked-fetch tests.

### Specs vs vibe
- Core logic goes through specs because the receipt chain has to be correct.
- Planned for UI polish: vibe coding on the haunted graveyard look.

## Planned
- Week 2: agent hooks (tests run on save, spec/tasks kept in sync), MCP (GitHub and fetch servers), a custom `gravekeeper` agent config.
- Week 3: UI and Vercel deploy.
- Week 4: write-up.

### Tasks 5 & 6 — GitHub client and Revival Spec generator (Nov 3, 2026)

**Task 5 — `src/lib/github/client.ts`**

Kiro read the existing Wayback client to match its conventions (Result<T> return type, AbortSignal.timeout, never throws), then implemented three exports:

- `parseGitHubUrl(url)` — parses `https://github.com/owner/repo` (plus `.git` and trailing-slash variants) using the native `URL` class; returns `null` for anything that doesn't fit the two-segment path pattern.
- `fetchRepoMeta(owner, repo)` — calls the GitHub REST API `/repos/<owner>/<repo>` endpoint. Reads `GITHUB_TOKEN` from `process.env` when present (unauthenticated otherwise — never hardcoded). Maps 404 to `GITHUB_NOT_FOUND`, 403/429 to `GITHUB_RATE_LIMIT`. Returns `GitHubRepoMeta` extended with `language` so the spec generator can use GitHub's primary-language field without widening the shared type.
- `fetchCommits(owner, repo, perPage?)` — calls `/repos/<owner>/<repo>/commits?per_page=N` and extracts the first line of each commit message, author date, and author name.

The test file (`client.test.ts`) stubs `globalThis.fetch` with `vi.stubGlobal` so no real HTTP calls are made. It covers all success paths, all error codes (NOT_FOUND, RATE_LIMIT, HTTP_ERROR, NETWORK_TIMEOUT), header assertions, and the `per_page` query-string parameter.

**Task 6 — `src/lib/spec/generator.ts`**

`generateRevivalSpec(meta, commits)` is a pure, synchronous function — no IO. It:

- Populates `detectedLanguages` from GitHub's `language` field, guarding against languages not in the known-languages set.
- Adds an `archived` stale-dep entry when `archivedByGitHub` is true.
- Generates at least three ordered revival steps (fork & clone, update README, audit dependencies) and adds conditional steps for: open issues triage, revival-communication notice (when last commit is > 12 months old), and adding a license when none is detected.
- Stamps `generatedAt` with the current UTC ISO timestamp.

The test file (`generator.test.ts`) has focused unit tests for archived repos, repos with no language, recent vs old commits, missing license, and open issues — plus a set of fast-check property-based tests (200 runs each) that verify: the function never throws on valid input, always produces at least three steps, step `order` values are monotonically increasing from 1, the output is deterministic across two calls with the same input, and `generatedAt` is always a valid ISO 8601 string. `fc.date()` was generating `Invalid Date` objects in fast-check v4, so date values are produced with `fc.integer` timestamps mapped to ISO strings instead.

Total test count after both tasks: **78 tests across 5 files, all green**.
