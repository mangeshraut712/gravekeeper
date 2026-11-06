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

## Nov 6, 2026 UTC (Nov 7 IST) — working interface, safety fixes, and actual Kiro review

The existing project was resumed rather than recreated. The interface, URL validation, operator-only fork guard, and initial browser proof tools in this session were implemented outside Kiro. Existing Kiro-generated steering and specs were preserved.

After the credited Google account was verified on Kiro Free, a bounded `kiro-cli chat --agent gravekeeper-review --no-interactive --output-format stream-json` session reviewed the relevant source files. The review agent has read/grep/glob tools only, no shell or write tools, and `includeMcpJson: false`. Kiro did not execute tests or modify files in this review.

Kiro identified two particularly useful issues:

1. Different error payload digests could distinguish a private repository visible to an operator token from a missing repository. Error text was unified and error receipts now contain fixed error codes rather than upstream text.
2. The first proof verifier checked receipt signatures and links but not the displayed result payload. Responses now include exact evidence for each receipt; verification recomputes each evidence digest and binds it to the displayed archive, repository, commits, and plan. Added regression cases reject changed, removed, or unsigned display data.

The review also prompted malformed-upstream guards, cancellation propagation, concurrent archive/metadata fetching, a JSON failure boundary, and clearer documentation of trust limits. These follow-up changes were implemented and tested outside Kiro.

Reported Kiro metering: **0.8453159646766168 credits**, from two credit entries in the CLI metadata. The CLI did not expose exact input/output token counts. This is not a WBM token count. No WBM upload was performed. A metadata-only record is committed under `.kiro/evidence/`; full local session output is not published.

Validation and release status are tracked in `docs/RELEASE_CHECKLIST.md`. Hook/MCP configuration files alone are not evidence that those integrations ran. No contest submission or deployment has been made by this session.

A second bounded read-only Kiro review checked the fixes. It found no remaining release-blocking/high-impact issue in the source it read. It did not run tests, and its test reads were truncated, so this is a source review rather than independent test execution. Its remaining 403-versus-404 concern was addressed afterward: non-rate-limit 403s now use the same public-not-found result; actual rate limits are identified by headers or HTTP 429. Cancellation and that error distinction have explicit regressions.

The second review reported **1.076201503814262 credits**. Total for both reviews: approximately **1.9215 credits**. These are provider-reported credit entries, not token estimates or WBM records.

## Nov 7, 2026 — Resurrection case 001 (licensed end-to-end restoration)

This work was done in `kiro-cli` sessions on this Mac with the repo's steering loaded. I have not recorded credit usage for them, so none is claimed here. These sessions are not evidence of hook or MCP execution.

- Found an uncommitted restoration prototype in the working tree: pinned MIT `esrever` source, an `Intl.Segmenter` reimplementation, 12 fixtures, an offline hash-checking verifier, a `/restoration` page, and tests. Kept and finished it rather than rewriting.
- Finished: the page linked `/restoration-kit.zip`, which did not exist. Added `scripts/build-restoration-kit.sh` (`npm run demo:kit`), generated the zip, and verified it runs offline from an unzipped copy (12/12). Added `third_party/esrever/README.md` attribution.
- Removed stray `.bak` agent files left by a Kiro config upgrade; the upgraded `.kiro/agents/*.json` (permissions blocks) are committed.
- Updated README with how to run and demo the restoration. Category stays Resurrection.

## Nov 7, 2026 — Release-check pass (kiro-cli session)

Run in a `kiro-cli` session. No hook or MCP execution is claimed, and no credit figure is recorded. Product code unchanged. Ran tests (170 passing), lint, typecheck, production build, and `demo:verify` at f80bc4c, and recorded that in `docs/RELEASE_CHECKLIST.md`. Rebuilding the kit zip yields a byte-different file (timestamps only), so the committed zip was left as is.

## Nov 7, 2026 — Kit drift test (kiro-cli session)

Run in a `kiro-cli` session; no credit figure is recorded. Added `src/lib/restoration/kit.test.ts`, which unzips `public/restoration-kit.zip` and checks that each file is byte-identical to the current source (verifier, reverse.mts, fixtures, pinned upstream, both licenses). It skips if `unzip` is unavailable. Product code is unchanged. The post-save hook found no `tasks.md` item that this completes. Tests: 171 passing, lint and typecheck clean.

## Nov 7, 2026 IST — PR #3 reconciliation and review fixes

Preserved and reconciled the existing staged Lantern Hill files with the safer workbench. This work was done in `kiro-cli` sessions on this Mac (local CLI session records line up with the merge and follow-up commits); no credit figure is recorded for them. The original fixture now lives separately at `/lantern-hill`, without replacing live lookup or the licensed esrever demonstration. Fixed malformed-signature handling, empty receipt exports, muted-text contrast, and overly broad Unicode property-test claims.

Separately, attempted one bounded read-only `kiro-cli chat --agent gravekeeper-review --no-interactive --output-format stream-json` review. The execution environment blocked the CLI's telemetry network request before a review completed. No successful review, credit usage, token count or WBM record is claimed for this attempt. Network controls were not changed or bypassed.
