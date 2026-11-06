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

## Week 2 start (Nov 6, 2026) — hooks, MCP, agent, tasks 7–8

### kiro-cli session
- Attempted: `kiro-cli chat --no-interactive --trust-all-tools` asking for hook / MCP / custom-agent schema examples (read-only).
- Outcome: Kiro started (KAS 0.66.70, logged in as mbr63@drexel.edu via GitHub) then hit the monthly usage limit:
  `UsageLimitReachedError` (Request ID: 77c1dc5a-83ae-4fe8-ba9c-c325432a5e65). No project files were written by that session.
- Credit request form was already submitted earlier on Nov 6; waiting on the credit grant. Work below was finished by hand to match existing Result / receipt / mocked-fetch patterns.

### Depth artifacts (committed under `.kiro/`)
- `.kiro/hooks/run-tests-on-save.json` — `PostFileSave` on `src/lib/**/*.ts(x)` runs `npm test`.
- `.kiro/hooks/keep-tasks-in-sync.json` — agent prompts to tick `tasks.md` and check design/tasks drift after src/types or API edits.
- `.kiro/settings/mcp.json` — GitHub (`@modelcontextprotocol/server-github`) and fetch (`@modelcontextprotocol/server-fetch`) via npx; token only through `${GITHUB_TOKEN}` (no secrets in repo).
- `.kiro/agents/gravekeeper.json` — scoped tools + steering/spec resources + `includeMcpJson: true`.

### Tasks 7–8
- `src/lib/github/client.ts`: added `createFork` (returns `Result`, never throws; maps missing token → `FORK_FAILED`).
- `src/app/api/resurrect/route.ts`: POST orchestrates Wayback → optional GitHub meta/commits → revival spec; builds hash-chained receipts; partial 200 on upstream misses.
- `src/app/api/fork/route.ts`: POST validates body, 503 without token, forks via `createFork`, returns `{ forkUrl, receipt, publicKey }`.
- Tests: `route.test.ts` for both APIs + createFork unit tests; property check that a successful resurrect path yields a chain that passes `verifyChain`. Extra canonical JSON UTF-8 round-trip property in `chain.test.ts`.
- `tasks.md` Task 7 and Task 8 checkboxes marked done.
- Test count after this session: **92** across 7 files, all green.

## Resurrection milestone (Nov 6, 2026) — restore a dead page, verify the chain, product UI

### Kiro session

This milestone was not produced by a Kiro session.

- `kiro` and `kiro-cli` are not installed in this environment (`command -v` finds neither). No chat was started, and no Kiro credits were requested.
- The last recorded Kiro CLI attempt is the Week 2 entry above. It hit `UsageLimitReachedError` (Request ID `77c1dc5a-83ae-4fe8-ba9c-c325432a5e65`) and wrote no project files.
- The work followed the existing `.kiro` artifacts already in the repo:
  - Steering: `product.md`, `tech.md`, `structure.md` (Next 16, Tailwind v4, Vitest, fast-check, Result types, no manual `useMemo`).
  - Spec: `.kiro/specs/resurrect/` user stories US-01 (submit), US-04 (exportable receipt chain), US-07 (keyboard, reduced motion, contrast, live regions), plus the design's route and receipt model.
  - Hooks, MCP config, and `.kiro/agents/gravekeeper.json` were left as committed. Nothing new was added under `.kiro/hooks`, `.kiro/settings`, or `.kiro/agents`. `.kiro` is still not gitignored.
- `tasks.md` and `design.md` were updated by hand so they match the code. The new checkboxes are bookkeeping, not a claim that Kiro executed those tasks.
- Property-based tests were extended by hand with fast-check, in the same style as the earlier receipt tests. Kiro's PBT workflow was not run.

### What the code added

- `src/lib/restore/` — Lantern Hill, an original MIT-licensed 1999 homepage fixture, and `restoreDeadHtml()`, which rewrites that page into semantic HTML. The fixture URL short-circuits `POST /api/resurrect` so the demo does not call Wayback or GitHub. Other URLs keep the previous live lookup.
- Receipt kinds `fixture` and `restoration`, chained and signed with the existing Ed25519 helpers. `contentSha256` covers the before and after HTML bytes.
- `src/lib/receipts/export.ts` plus `POST /api/verify`. The product UI also verifies in the browser with the same function, including a tampered-copy check.
- The homepage is the Gravekeeper product (URL field, before/after, receipts, revival checklist for GitHub lookups). `page.tsx` is no longer the create-next-app starter.
- `GET /api/fork` reports whether `GITHUB_TOKEN` is set. It does not return the token. Fork creation still returns 503 without one.

Test count after this milestone: **110** passing (`npm test`). `npm run build` completes, with `/fixtures/lantern-hill/before` and `/after` prerendered.
