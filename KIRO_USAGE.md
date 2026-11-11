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

## Nov 10, 2026 IST — Fog overlay, Kiro review, and Vercel deploy

The FogOverlay component, CSS drift keyframes, home-page composition, hook matcher change, and tests were written outside Kiro, then checked with one bounded read-only `kiro-cli chat --agent gravekeeper-review --no-interactive --output-format stream-json` session (session `d07e79e4-2ad2-40da-9bfe-7d3c815c1d88`). The review agent has read/grep/glob tools only. Kiro did not execute tests or modify files.

Kiro found no bugs in the five files it read. It recommended tightening the home-page test so `aria-hidden` and `motion-reduce:hidden` are asserted on the fog overlay tag itself, and noted that `"use client"` is unnecessary for this CSS-only component but harmless. The test was tightened afterward. `"use client"` was left in place to match the Task 14 spec.

Reported Kiro metering: **0.4055374147595356 credits**, from two credit entries in the CLI metadata. The CLI did not expose exact input/output token counts. This is not a WBM token count. No WBM upload was performed. A metadata-only record is committed under `.kiro/evidence/2026-11-10-fog-review.json`; full local session output is not published.

The save hook in `.kiro/hooks/run-tests-on-save.json` now also runs when files under `src/components` are saved. Hook or MCP execution is not claimed for this session.

A public Vercel production deployment was created on the existing Hobby team `mbr63` (account `mbr63drexel`), with `GITHUB_TOKEN` and `FORK_API_SECRET` left unset. Vercel Authentication was turned off so the demo URLs are reachable without a Vercel login. Live URL: https://gravekeeper-drab.vercel.app


## Nov 11, 2026 — Judge-ready a11y, metadata, and CI pass (Kiro agent session)

Branch `feat/judge-ready-a11y-ci-20261111`, from main `9899869`. No credit figure, token count, or WBM record is available for this session, so none is claimed. No hook or MCP execution is claimed.

**Kiro-generated (agent wrote and ran these):**
- Extracted `SearchForm`, `TombstoneCard`, `ReceiptChainViewer`, `RevivalSpecPanel` (plus shared `Mark.tsx`, `styles.ts`) from `Gravekeeper.tsx`; revival plan became a native-`<details>` accordion with `motion-reduce` handling; tombstone card gained the R.I.P. motif and snapshot date; Escape cancels a running lookup.
- `scripts/a11y-audit.mts` (`npm run a11y`) and the dev dependencies `playwright` 1.65.0 and `@axe-core/playwright` 4.14.0; ran the scans, a keyboard-path check, and a pixel-sampled contrast measurement for the nodes axe marked "needs review"; wrote `docs/A11Y_AUDIT.md` from those outputs.
- `.github/workflows/ci.yml`, `docs/DEMO_SCRIPT.md`, README live links, and the `tasks.md` reconciliation.
- Task 14 (FogOverlay) was verified as already done on main and only checked off, not reimplemented. The `<title>`/Open Graph `metadata` export already existed in `layout.tsx`; it was verified and checked off, not changed.

**Hand work (outside the agent):** none in this session beyond the prompt that set the milestone and constraints. The demo script has not been rehearsed or recorded by a person, and no video exists.

**Deviations and limits worth knowing:**
- Task 16 said `@axe-core/react`; Playwright-based axe was used instead because it scans the production build and sandboxed pages.
- Playwright downloaded its own Chromium build (`npx playwright install chromium`) during the session.
- An early scan flagged one contrast violation that turned out to be axe sampling a mid-fade animation; the script now waits for finite animations, and no styles were changed for it.
- The pass was not reviewed by a second Kiro review agent.

## Nov 11, 2026 — Component tests and small a11y follow-up (kiro-cli session)

Branch `feat/judge-ready-a11y-ci-20261111`. No credit figure, token count, or WBM record is available for this session, so none is claimed. No hook or MCP execution is claimed. No Devpost submission, video, or social post was made.

- Added static-markup tests (`renderToStaticMarkup`, no new dependencies) for `SearchForm`, `TombstoneCard`, `ReceiptChainViewer`, and `RevivalSpecPanel`. Behavior that needs a DOM (invalid-URL error text, example-button clicks, disabled-while-loading, verify/download clicks) is not covered by these tests.
- `TombstoneCard`: the decorative arrows on "View repository" and "Fork on GitHub" are now `aria-hidden`, matching the snapshot link. Visible text unchanged.
- `tasks.md` Task 15: replaced a stale bullet that said the sections still lived in `Gravekeeper.tsx` with the current composition.

## Nov 11, 2026 — Dot P2 follow-up on PR #5

Branch `feat/judge-ready-a11y-ci-20261111`. No credit figure, token count, or WBM record is available for this session, so none is claimed. No hook or MCP execution is claimed. No Devpost submission, video, or social post was made.

- Restored the `Open issues / PRs` count on `TombstoneCard`, shown alongside the archive snapshot date (it had been dropped when the card was extracted). Added a static-markup assertion for label and value with `openIssues=42`.
- `scripts/a11y-audit.mts --lookup` now opens receipt `<details>` inside the proof section (`section[aria-labelledby="proof-title"]`), asserts the receipt body fields are visible, and fails if those selectors are missing. It no longer opens the first page disclosure ("Detected stack"). `docs/A11Y_AUDIT.md` records the corrected coverage; the previously recorded lookup-state axe counts predate this fix and need a re-run to refresh.

## Nov 11, 2026 — PR #5 follow-up: proof status a11y, error/cancel scans (Kiro agent session)

Branch `feat/judge-ready-a11y-ci-20261111`, from `c3cfd8e`. No credit figure or token count was exposed by this session's metadata, so none is claimed. No hook or MCP execution was observed or is claimed. No Devpost submission, video, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `ReceiptChainViewer`: new exported `ProofStatus` renders verification and download-error text in two separate `role="status"` regions, so a failed Download proof is announced after verification is valid or invalid. `download()` clears the error at the start of each attempt, so a later success removes it. Tests in `ReceiptChainViewer.test.tsx` (static markup) cover the error with every verification state.
- `scripts/a11y-audit.mts`: always scans invalid-URL, mocked server-error, running (Cancel visible) and canceled states with `/api/resurrect` mocked; throws if a state is not reached.
- Ran `npm run a11y` and `npm run a11y -- --lookup` on a production build and refreshed `docs/A11Y_AUDIT.md`. The live `atom/atom` lookup needed network.

**Hand work:** none beyond the prompt.

**Limits:** the "later download succeeds clears the error" path is by code, not a click test (it needs a DOM environment and no new dependency was added). Contrast pixel-sampling was not repeated for the new states. No second Kiro review.

**Correction (added later):** the CLI stream-json metadata for the PR #5 follow-up session above showed **2.2152887970149253 credits** for the whole session (one credit entry, unit credit). The entry above said no figure was available; this is the figure. It is provider-reported credits, not a token count or WBM record.

## Nov 11, 2026 — Real screenshots, README, and leftovers (Kiro agent session)

Branch `feat/judge-ready-a11y-ci-20261111`, from `678a087`. This run exposed no credit figure or token count in its metadata, so none is claimed. No hook or MCP execution was observed or is claimed. No Devpost submission, video, or social post was made.

- Added `scripts/capture-screenshots.mts` and captured five PNGs into `docs/screenshots/` from a local production build with Playwright's Chromium. The results shot uses a mocked `/api/resurrect` response built from synthetic data (`example/abandoned-widget`) and signed with the project's receipt code; it is not a live lookup, and the README says so.
- README now shows the screenshots with captions. `tasks.md` Task 16 leftovers were trimmed to what is still undone (screen-reader pass, non-Chromium browsers, real upstream failure scan, contrast re-sampling for the newer states).
- Not done: screen-reader pass, other browsers, live-lookup screenshot.

**Correction (added later):** the CLI stream-json metadata for the screenshots session at 03c7029 showed **4.765427657379767 credits** for the whole session (one credit entry, unit credit). The entry above said no figure was exposed; this is the figure. It is provider-reported credits, not a token count or WBM record.

## Nov 11, 2026 — Week 4 submission drafts (Kiro agent session)

Branch `feat/judge-ready-a11y-ci-20261111`, from `03c7029`. This run exposed no credit figure or token count in its metadata, so none is claimed. No hook or MCP execution was observed or is claimed. Kiro powers and Crew were not used. No Devpost submission, video, blog publish, or social post was made.

- Wrote drafts only, under `docs/submission/`: `WRITEUP.md`, `DEVPOST.md`, `BLOG_DRAFT.md`, `SOCIAL_DRAFT.md`. Added a second, longer (~2:30 to 2:45) cut to `docs/DEMO_SCRIPT.md`. No product code changed.
- Drafts were written from the repo files and this log. Student, startup, Ghost of Kiroween Past and Crew items are left as owner-input blanks and are not claimed.
- Remaining for Mangesh: record and upload the video, publish the blog, post socially, fill in the URLs, confirm Student eligibility, and submit on Devpost. A screen reader pass is still not done.

**Correction (added later):** the CLI stream-json metadata for the submission-drafts session at 16b6742 showed **2.390755344776119 credits** for the whole session (one credit entry, unit credit). The entry above said no figure was exposed; this is the figure. It is provider-reported credits, not a token count or WBM record.

## Nov 11, 2026 — Non-Chromium a11y, contrast re-sample, live screenshot, hook + MCP exercise (Kiro agent session)

Branch `feat/kiro-depth-20261111`, from `9165fa3`. Session `sess_a0090c9c-b917-4a73-b475-7fa3e3995e0e`. This run's metadata exposed no credit figure or token count, so none is claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `scripts/a11y-audit.mts`: `--browser=` / `--browsers=` for Chromium, Firefox and WebKit; a launch failure exits with code 2. Scanned all three against a local production build, including the live `atom/atom` lookup: 0 counted violations in each, plus the 4 intentional findings on the "before" fixture. Found and worked around a Firefox-only hang (the post-lookup animation wait never resolved); the wait is now capped at 2 s. `docs/A11Y_AUDIT.md` updated with per-browser results and that limit.
- `scripts/contrast-sample.mts`: per-text-box pixel sampling for the initial, invalid-URL, mocked-error, running, canceled and live-result states. The first two versions gave misleading failures (leftover placeholder text, underlines, a page-wide max pixel); they were fixed before the recorded numbers were taken. Lowest ratio 7.13:1 in the sampled frames, with caveats written in the audit.
- `scripts/capture-screenshots.mts --live` (optional; default mocked run unchanged) and `docs/screenshots/home-lookup-live.png`, a real `atom/atom` lookup (4 receipts, results complete), added to the README as live. The mocked `home-lookup.png` stays labeled mocked.
- Added a regression test in `src/lib/wayback/client.test.ts` (malformed snapshot timestamp returns `PARSE_ERROR`). That save triggered the hooks.
- Hooks, observed: the `keep-tasks-md-in-sync` agent hook delivered its prompt after the save; `kiro.log` shows two hook-invocation events at 10:35:54Z. The hook found no task completed by the test, so it changed nothing. The `npm test` command hook's output was not attached, so its result was not observed; `npm test` was run by hand.
- MCP, observed with `scripts/mcp-probe.mts` (direct stdio client, not Kiro calling the tool): the configured `@modelcontextprotocol/server-fetch` does not exist on npm (404), so the config now uses `uvx mcp-server-fetch`; that server started and its `fetch` tool returned the Wayback availability JSON for `github.com/atom/atom`. The GitHub MCP server started and listed 26 tools; `GITHUB_TOKEN` was not set so no GitHub tool was called.
- Evidence: `.kiro/evidence/2026-11-11-hook-mcp-exercise.json` (metadata only). `docs/submission/*` and `tasks.md` updated to match.

**Hand work:** none beyond the prompt.

**Limits:** no screen-reader pass; contrast sampled in Chromium only and only three animation frames; no real upstream-failure scan; Kiro was not shown calling an MCP tool in a chat turn.

## Nov 11, 2026 — Dependency autopsy (Kiro agent session)

Branch `feat/dependency-autopsy-20261111`, from main `9165fa3`. Evidence: `.kiro/evidence/2026-11-11-dependency-autopsy.json`. Credit usage was not exposed to the agent and is not claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated:** spec-first work under `.kiro/specs/dependency-autopsy/` (requirements, design, tasks committed before code as `e8b6285`). Implemented types, a dependency-free npm/PyPI floor comparator, manifest parsers, autopsy builder, manifest fetch, registry client, `/api/resurrect` receipts, proof verification, revival-plan steps, and an accessible `DependencyAutopsyPanel`. Documented real local production-build lookups of `atom/atom` and `facebookarchive/flux` in `docs/DEPENDENCY_AUTOPSY.md`.

**PR #7 review fixes (also Kiro):** two Codex P2 findings. (1) A dependency spec longer than 256 characters was accepted by the parser but rejected by the evidence validator, so the whole autopsy became null and `verifyProof` failed; parsers now share the evidence length limits and skip over-limit entries (`e00b40d`). (2) An npm comparator set with several lower bounds used the first bound instead of the strongest; the floor is now the max lower bound in a set and the min across `||` (`5fec660`). Tests were written first. After those fixes: 32 files, 442 tests, lint, `tsc`, build, and `demo:verify` passed.

**Limits recorded then:** the session's `git pull --no-rebase origin/main` reported already up to date, but the branch was still based at `9165fa3` and did not contain PRs #6 and #8. A third Codex P2 (exclusive npm partials / X-ranges) was not fixed in that session. Real lookups were not re-run after the review fixes.

## Nov 11, 2026 — Exclusive npm floors and merge of main (hand work)

Not a Kiro session. The follow-up kiro-cli resume (`sess_896d8716-8cca-40c1-846e-8b21e710a68d`, started about 16:11 IST) had already committed the two review fixes, then went silent (no log growth after 16:14 IST, 0% CPU). It was stopped with SIGTERM at 16:32 IST after its 20-minute check-poll window, without merging. PID 73527 was not touched. A separate kiro-cli job in the `gravekeeper-proof` worktree was left running.

- Codex P2: `>1` and `>1.x` already require `2.0.0`, but the floor was `1` / `1.0`, so a current major was classified `major-behind`. Exclusive partials and X-ranges now raise the last precise component; fully specified `>1.2.3` is unchanged. Failing unit and property tests first, then the fix, in `8dca3d4`.
- Merged `origin/main` (`4184d6f`, PRs #6 and #8) with `git merge --no-edit` (no rebase, no force-push). No conflicts.
- After the merge: `npm test` 33 files, 482 passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify`. All passed.

No credit figure is claimed for this hand work. No Devpost submission, video, blog publish, or social post was made.

## Nov 11, 2026 — Proof workbench, restoration properties, fog margin, Lighthouse (Kiro agent session)

Branch `feat/proof-restoration-20261111`, from `4184d6f`. This run's metadata exposed no credit figure or token count, so none is claimed. No hook or MCP execution was observed or is claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `/proof` workbench: `.kiro/specs/proof-workbench/` (EARS requirements, design, tasks), `src/app/proof/analyze.ts` (wraps the unmodified `src/client/proof.ts` and `verifyReceiptExport`), `src/components/ProofWorkbench.tsx`, `SiteFooter` linked from `layout.tsx`. 18 analyzer tests with real signed fixtures, and component tests. `scripts/proof-smoke.mts` drives a real Chromium: downloads the Lantern Hill receipt file, loads it on `/proof` through the file input (valid), tampers it (invalid), bad JSON (error, no verdict), paste, a synthetic drop event, Tab order, and confirms no POST requests. 9/9 passed. A real mouse drag from the OS was not exercised.
- Restoration property tests (fast-check): never throws and returns a string; UTF-16 length and code-unit multiset preserved; concatenation distributes (swapped) on a plain alphabet; identity on single graphemes; segment count never increases (also run 30,000 times on an adversarial combining/ZWJ/regional-indicator alphabet, one-off, not committed). `compareVersions` invariants. The existing warning about non-involution on leading combining marks is unchanged.
- Fog: alphas reduced; a unit test recomputes worst-case contrast from the CSS; `scripts/fog-sweep.mts` sweeps 144 phase pairs per viewport. Finding: with the old CSS the sweep peaked at `#292a23` (5.60:1), not the `#55514c` recorded earlier, so the old CSS did not fail in this measurement and the source of `#55514c` is unexplained. Details in `docs/A11Y_AUDIT.md`.
- Lighthouse 13.6.0 (pinned) via `npm run lighthouse`: all 100s after one fix. The first run caught CLS 0.113 on `/lantern-hill` caused by the new footer; fixed with a taller Suspense fallback. Lab numbers on localhost only. See `docs/LIGHTHOUSE.md`.

**Hand work:** none beyond the prompt.

**Limits:** no screen-reader pass; no OS-level drag test; Chromium only for the new checks; the deployed site was not measured.

## Nov 11, 2026 — PR #7 review follow-ups (hand work)

Not a Kiro session. After the exclusive-floor entry above, Codex and Cursor Bugbot kept filing findings on this branch; each verified one was fixed with tests first, then pushed (no force-push, no PR replies, PID 73527 not touched). Credit usage is not claimed here.

- Browser CI: `@/lib` aliases failed under Node e2e; `generator.ts` now uses a relative import of `majorOf` (`b21df84`).
- Codex P2: `>=1.0,!=1.*` ignored the exclusion and floored at `1.0`; floors now bump past prefix exclusions, and an exact `!=` of the floor returns null (`d8d698c`).
- Codex P2: repeated Python requirements kept only the first line; `mergePypiSpecs` / `addOrMergePypi` combine them, and conflicting exact pins yield no floor (`3abf399`).
- Codex P2 and Bugbot: a merged spec can exceed 256 characters, and `==1.*` was recorded as an exact pin of `1`; overflow now keeps the previous valid spec, and wildcard equality is a prefix (`b6838af`).
- Bugbot: `==1.*,>=2.0` still returned a floor of `2.0` outside the required series; floors and pins must sit inside every `==N.*` prefix (`83c38c5`).
- Codex P2: `addOrMergePypi` used `findIndex` on every requirement, so a large unique manifest was quadratic. Parsing now uses a name-to-index map (this commit).

Limits: Kilo review was still pending on some of these heads; later findings arrived after earlier fixes. No Devpost submission, video, blog publish, or social post was made.

- Codex P2: `==1.0-rc1` against latest `1.0rc2` compared as current because the hyphenated form kept `rc1` as one identifier. PyPI parsing now splits known pre tags (`rc1` → `['rc', 1]`); npm identifier semantics are unchanged.

## Nov 11, 2026 — Epitaph timeline and permalinks (Kiro agent session)

Branch `feat/epitaph-timeline-20261111`, from `7c927bf` (PR #7 tip). Session `sess_01f7c850-64cc-429f-9ccc-2fb2296f888e`. Evidence: `.kiro/evidence/2026-11-11-epitaph-timeline.json`. The session metadata available to the agent exposed no credit figure or token count, so none is claimed. No MCP server was used. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- Spec first: `.kiro/specs/epitaph-timeline/` (EARS requirements ET-01 to ET-05, design with seven correctness properties, tasks), committed before code as `d44a06d`.
- `src/lib/wayback/timeline.ts` (pure, isomorphic CDX parsing and per-year aggregation), `src/lib/wayback/cdx.ts` (10 s timeout, cancel signal, 512 KiB cap, typed errors), a new `wayback-cdx` receipt recorded after the first receipt, and `verifyProof` binding the displayed timeline to the signed evidence and the receipt URL to the resource. Older proofs without a timeline still verify.
- `EpitaphTimeline` panel (born, last seen, years on record, `aria-hidden` SVG bars with a text summary and a `<details>` table; loading, missing, empty, unavailable and truncated states; no animation on the chart) and `CopyLinkButton` with a polite status region.
- Permalinks: `/?url=` fills the input and runs one lookup only if `normalizePublicUrl` accepts it; otherwise no request and a status message. The address bar is replaced with the permalink after a successful lookup.
- Tests: unit and fast-check properties for aggregation (sum, contiguous sorted years, first ≤ last, parser/validator agreement), the CDX client (mocked fetch), permalinks (round-trip property), route and proof tamper cases, and static-markup component tests. `scripts/e2e-smoke.mts` gained four steps (Epitaph panel, permalink, address bar, rejected permalink).
- Fixed a pre-existing break found by `npm run e2e`: `src/lib/spec/generator.ts` imported `@/lib/deps/semver`, which Node's native TypeScript cannot resolve, so the e2e script could not start. It now uses a relative `.ts` import.
- Real production-build lookups, recorded in `docs/EPITAPH_TIMELINE.md`: `atom/atom` returned a complete 2014–2026 timeline (136 captured months), and its proof verified offline. `http://www.geocities.com` returned 200, but the CDX index did not answer within 10 s on either attempt (`NETWORK_TIMEOUT`), so no life-span numbers were produced for it.

**Hooks, observed in this session:** agent-hook instructions arrived after file saves made through the editor tools: the requirements-coverage check after `requirements.md` was saved (no gaps found), the tasks.md sync check after `src/` saves (the resurrect `tasks.md` had no item completed by this work, so it was left unchanged), and the spec-drift check after a route test save (`.kiro/specs/resurrect/design.md` gained `wayback-cdx` and `timeline`). Edits made through shell commands do not trigger save hooks. The output of the `npm test` command hook was not observed, so its execution is not claimed; tests were run directly.

**Checks (final tree):** `npm test` 37 files, 557 tests passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify`; `npm run e2e` against `npx next start -p 3400`, 12/12 passed, server stopped afterwards.

**Hand work:** none beyond the prompt.

**Limits:** no axe scan, contrast sampling or screen-reader pass for the new panel. This worktree's `node_modules` had been a symlink into another checkout, and the build could not resolve `next` through it. The symlink was removed (the target was not touched), and `npm ci` installed a local copy. `package.json` and the lockfile were not changed.

## Nov 11, 2026 — Performance measurements, share previews and UI polish (Kiro agent session)

Branch `perf/polish-and-share-20261111`, from `4184d6f`. The credit figure for this session is recorded by the runner, not here. No token count or WBM record is claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `scripts/lighthouse-run.mjs`: Lighthouse 12.8.2 via `npx -y lighthouse@12`, mobile and `--preset=desktop`, 3 warmed runs per page, median reported. Before and after numbers for `/`, `/restoration` and `/lantern-hill` are in `docs/PERFORMANCE.md`. Scores were already 98 to 100 and did not move beyond run spread. A first cold run of `/` mobile scored 69 (2,820 ms TBT) and did not repeat; it is recorded as an outlier.
- Tried `experimental.inlineCss` for the render-blocking CSS finding. Mobile LCP got worse and gzipped HTML grew from 6.2 KB to 24.3 KB, so it was reverted and not committed.
- `scripts/polish-check.mts` (+ `scripts/synthetic-lookup.mts`, synthetic `example/abandoned-widget` data): horizontal scroll, visible focus on every tab stop (including the results state), and layout shift after results, at 375x812 and 1440x900. Found two real issues and fixed them: the lookup status line and Cancel row shifted the page when results arrived (0.0554 to 0.0004 at 375 px), and the Lantern Hill preview iframes showed no focus indicator (new `PreviewFrame`, sandbox unchanged). Screenshots in `docs/screenshots/polish/`.
- Share previews and metadata: `opengraph-image.tsx` / `twitter-image.tsx` (1200x630 PNG from the app's own palette and mark), `metadataBase`, canonical URLs, per-page descriptions for the two demo pages, `themeColor`, `robots.ts`, `sitemap.ts`. Checked with curl: both image routes return `200 image/png`, `file` reports 1200 x 630. Lighthouse `canonical` and `robots-txt` audits now apply and pass.
- `node_modules` in this worktree was a symlink to another checkout, which Turbopack refused to resolve; it was replaced with a local `npm ci` (the symlink only, not its target).
- Checks run: `npm test` (261 passed), `npm run lint`, `npx next typegen && npx tsc --noEmit`, `npm run build`, `npm run demo:verify` (4/12 before, 12/12 after), `npm run e2e` (all passed) and `npm run a11y` (Chromium, 0 counted violations, 4 intentional on the "before" fixture) against a production build on port 3418.
- Hooks, observed: after each `src/` save the `keep-tasks-in-sync` agent-hook prompt arrived; no unchecked task in `tasks.md` was completed by these changes, so it was left unchanged. The `npm test` save-hook's output was not attached, so its result was not observed; `npm test` was run by hand.

**Hand work:** none beyond the prompt.

**Limits:** local lab numbers on one machine, simulated mobile throttling, Chromium only for the polish check; the Vercel deployment was not measured; social card rendering on actual networks was not checked; no screen-reader pass.

**Review follow-up (PR #10):** Cursor Bugbot reported that the demo pages inherited the home Twitter text. Reproduced with a failing test, then found with curl that those pages also had no `og:image` / `twitter:image`, because a page-level `openGraph` or `twitter` object replaces the inherited one. Fixed by setting page Twitter text and listing the share images explicitly. After the fix: `npm test` 263 passed, lint, `tsc`, build, e2e and `demo:verify` passed. Codex and Kilo reported no findings.

## Nov 11, 2026 — Revival kit export (Kiro agent session)

Branch `feat/revival-kit-export-20261111`, from `70d5a7d` (PR #11 tip, which includes the merged PR #7 autopsy). Session `sess_5e434b4f-4aaf-4888-a574-82fb093c9f42`. Evidence: `.kiro/evidence/2026-11-11-revival-kit.json`. The credit figure for this session is recorded by the runner; the agent saw none, so none is claimed here. No MCP server was used. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- Spec first: `.kiro/specs/revival-kit/` (EARS requirements RK-01 to RK-06, design with five correctness properties, tasks), committed before code as `f52061d`.
- `src/lib/revival/markdown.ts`: pure, deterministic generator for `REVIVAL.md` (facts, snapshot link, five recent commits, every plan step, autopsy table, Epitaph timeline, tracking issue, proof reference) and the "Revival tracking issue" body. `escapeMarkdown()` entity-escapes `& < >`, backslash-escapes Markdown/GitHub punctuation (links, code, emphasis, pipes, `@mentions`, `#refs`, math) and turns line breaks, controls and bidi characters into spaces.
- `src/client/kit.ts`: `prepareRevivalKit` runs `verifyProof` first, hashes the exact `exportProof` bytes with the existing `sha256hex`, and never throws. No new hashing scheme, no network.
- `RevivalKitPanel` ("Download revival kit", "Copy issue body", two polite status regions, trust-limit text), shown only when a result has a plan and GitHub metadata.
- Tests: unit tests for escaping and each section, fast-check properties (every step present in order with one checkbox each, no `<`/`>` from any user field, escape round trip, deterministic output, issue body embedded verbatim), signed-response refusal tests, static-markup component tests, and two e2e steps (download/copy tied to the proof SHA-256; tampered response refused with no download).
- A real bug found by the tests: `encodeURIComponent` does not encode `(` `)`, so a snapshot URL with parentheses could end the Markdown link early; now mapped explicitly.
- Real production-build export of `https://github.com/facebookarchive/flux` through the UI with Playwright, recorded verbatim in `docs/REVIVAL_KIT.md` (HTTP 200 in about 9.0 s, 7 receipts, browser and offline verification passed, proof SHA-256 named in the kit).

**Hooks, observed in this session:** the requirements-coverage agent hook fired after `requirements.md` was saved (before design and tasks existed, so everything was uncovered; re-checked after writing them, no gaps). The keep-tasks-in-sync agent hook fired on `src/` saves; `.kiro/specs/resurrect/tasks.md` had no item completed by this work and was left unchanged. Output of the `npm test` and receipts-property command hooks was not observed, so their execution is not claimed; tests were run directly. Files written through shell commands (the docs page) do not trigger save hooks.

**Checks:** `npm test` 40 files, 606 tests passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify` (after 12/12, before 4/12); `npm run e2e` against `npx next start -p 3400`, 14/14 passed, server stopped afterwards. After `git pull --no-rebase origin main` brought in PR #10 (one conflict, in this file; all entries kept, newest last): `npm test` 42 files, 616 tests passed; lint, typegen + tsc, build, `demo:verify` and e2e 14/14 passed again.

**Hand work:** none beyond the prompt.

**Limits:** no axe scan, contrast sampling or screen-reader pass for the new panel. The "Copy issue body" clipboard-failure message is covered by static markup only, not a browser test. The kit is not signed itself; it references the signed proof by hash.

**Review follow-up (PR #12):** Codex P2: Safari can drop the user gesture across the WebCrypto awaits before `writeText`, so Copy issue body could fail on a valid proof. Reproduced with failing tests, then added `copyIssueBody()`: when `ClipboardItem` exists the write starts synchronously in the click with a promise-backed item that resolves only after verification (rejects otherwise); without it, verify then `writeText`. Safari itself was not tested; the fix is checked by unit tests and the Chromium e2e. After the fix: `npm test` 42 files, 620 tests; lint, typegen + tsc, build, `demo:verify` and e2e 14/14 passed.

A second `git pull --no-rebase origin main` brought in PRs #9 and #11 (one conflict in this file, all entries kept). On that merged tree: `npm test` 44 files, 659 tests passed; lint, typegen + tsc, build, `demo:verify` (4/12 before, 12/12 after) and e2e 14/14 passed.
## Nov 11, 2026 — Kiro review of the post-9165fa3 code, then verified fixes (Kiro agent session)

Branch `fix/review-findings-20261111`, from main `7c2973f`. The credit figure for this working session is recorded by the runner, not here. No token count or WBM record is claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro review (read-only agent):** one bounded `kiro-cli chat --agent gravekeeper-review --no-interactive --trust-all-tools --output-format stream-json` run (session `sess_9c02bc20-a9ed-42b4-9abe-4b19724efb47`, 12:21:19Z to 12:26:47Z). It reviewed 27 listed files changed in `9165fa3..7c2973f`. The stream shows 28 read and 5 search tool calls and no shell, write or MCP calls. The stream-json `session_usage` metadata reported **5.634453310779436 credits** for the review. That figure is provider-reported, not a token count. Kiro found no SSRF, token leakage, HTML injection or proof-verification bypass. It reported quadratic regexes in manifest parsing, an uncapped manifest body read, three SearchForm issues, release-gate matcher gaps, and low-severity items. The summary and every outcome are in `docs/reviews/2026-11-11-kiro-review.md`, and metadata is in `.kiro/evidence/2026-11-11-review-findings.json`.

**Verification and fixes (agent session, tests first):**
- Timed the regex findings locally. 80k-line or 80k-character inputs took 21.6 s, 9.7 s and 4.9 s. Fixed in `7b62d07`, with regression tests that each took 2.8–12.5 s before the fix.
- `fetchRootManifest` now streams the body and cancels it once it passes 512 KiB (`ecdbf7f`). The streamed-body test failed first.
- SearchForm (`088fb1d`): non-JSON error pages show a plain message, `aria-invalid` is set only for URL validation, and focus moves to Cancel while loading and back to the field afterwards. Two new e2e steps failed against a build of the old SearchForm and passed after the fix. The e2e temp directory is now removed.
- Release gate (`347e2c5`): matches `-P`, `--git-dir <path>`, quoted words and line continuations, runs the checks on unparseable events, and has a 10-minute timeout per check. We did not use Kiro's broader regex because it would match `git stash push`.
- Autopsy table scroller is labelled by its caption (`d68b5d5`). `scripts/a11y-audit.mts` now expects `aria-invalid="false"` after a server error and after cancel (`3b388bf`).
- Rejected with reasons in the review file: rate limiting (no server storage, deployment-level), dist-tag note wording (would break existing proofs), 403-as-not-found (intended), `NETWORK_TIMEOUT` labelling (proof format), PreviewFrame poll, PyPI body size, and `verifyProof` hardening (documented trust limit).
- `node_modules` in this worktree was a symlink to another checkout, which Turbopack refused to resolve. Only the symlink was removed, and `npm ci` was run locally.

**Checks run:** `npm test` (35 files, 535 passed), `npm run lint`, `npx next typegen && npx tsc --noEmit`, `npm run build`, `npm run demo:verify` (4/12 before, 12/12 after), and, against `next start` on ports 3457/3458, `npm run e2e` (all passed) and `npm run a11y` (Chromium, 0 counted violations, plus the 4 intentional findings on the "before" fixture). After merging `origin/main` (`129c301`, PRs #9 and #11) every check was run again: `npm test` (41 files, 649 passed), lint, `tsc`, build, `demo:verify` (4/12 before, 12/12 after), e2e and a11y on port 3459. All passed.

**Hooks, observed:** after each `src/` save, the `keep-tasks-in-sync` prompt arrived. No unchecked `tasks.md` item was completed, so `tasks.md` was not changed. The `npm test` save hook's output was not attached, so its result was not observed; tests were run by hand.

**Limits:** the timings come from one machine. Firefox and WebKit were not rescanned. There was no screen-reader pass. Kiro did not review its own fixes.
## Nov 11, 2026 — Judge guide and docs pass (Kiro agent session)

Branch `docs/judge-guide-20261111`, from `main` at `129c301` (PRs #7, #9, #10 and #11 merged). The credit figure for this session is recorded by the runner, not here. No token count or WBM record is claimed. No hook fired in this session (only docs and `.kiro/evidence` were edited, and no hook matcher covers them), and no MCP server was used. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- README top section rewritten for judges: pitch, a 60-second path on the live app, a feature table with limits for what is on `main`, a Mermaid architecture diagram, setup commands and a "How Kiro built this" section. The existing screenshots and their mocked/live captions are kept; no screenshots were recaptured.
- `docs/JUDGES.md`: each judging criterion mapped to files and recorded results, plus the submission requirements with their status. The video is pending, the Devpost entry is not submitted, and Best Student Project is not entered.
- `docs/submission/WRITEUP.md`, `docs/submission/DEVPOST.md` and `docs/DEMO_SCRIPT.md` updated to match the merged features (autopsy, Epitaph, permalinks, `/proof`, share previews) and the evidence files. The demo scripts no longer say the plan ignores dependency files.
- `docs/KIRO_WORKFLOW.md` corrected against `.kiro/evidence`. Hook statuses now show which hooks were observed. The MCP section now names the `uvx mcp-server-fetch` config and the probe results. The later specs and evidence files are listed. The proof-workbench spec is marked as landing in the same commit as its code (`89a94fa`), not spec-first.
- Facts checked live and read-only: `gh repo view` (public, MIT detected), `git check-ignore .kiro` (not ignored), the GitHub contents API for `.kiro`, HTTP 200 on seven production paths, and two production `POST /api/resurrect` calls for `atom/atom` at about 12:38 UTC. Both calls returned 7 receipts with a complete timeline and a `package.json` autopsy. The Wayback availability API returned a miss both times.

**Checks:** `npm test` 41 files, 626 tests passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify` (4/12 before, 12/12 after); `npm run e2e` against `npx next start -p 3437`, 12/12 passed, server stopped afterwards.

**Hand work:** none beyond the prompt.

**Limits:** PR #12 (revival kit) is open and was not described as merged. `docs/submission/BLOG_DRAFT.md` and `SOCIAL_DRAFT.md` were not updated and still describe the earlier, metadata-only plan. No axe run, screenshot refresh or screen-reader pass was done in this session.

## Nov 11, 2026 — Judge guide follow-up (hand work)

Not a Kiro session. After PR #12 (`7a55157`) and PR #13 merged, this branch was updated with a normal merge of `origin/main` (every `KIRO_USAGE.md` entry kept). The 60-second path and both demo scripts said **Resurrect**; the live button is **Unearth project**, so those labels were corrected. The revival kit is now described as a merged feature (it was in the production JavaScript at 13:06:49 UTC). Credit usage is not claimed here. Checks after the edit: `npm test` 44 files, 682 passed; lint; typegen + tsc; build; `demo:verify` (4/12 before, 12/12 after). No Devpost submission, video upload, blog publish, or social post was made.

## Nov 11, 2026 — Judge guide, second pass after the kit merge (Kiro agent session)

Same Kiro session as the judge-guide entry above. The credit figure is recorded by the runner. No hook fired and no MCP server was used. No Devpost submission, video, blog publish, or social post was made.

- While PR #14 CI ran, the hand commit above (`dd8a700`) was pushed to this branch. The agent fast-forwarded to it with `git pull --no-rebase` (no force-push, all `KIRO_USAGE.md` entries kept). The agent's first drafts had used the wrong button label (**Resurrect**); `dd8a700` corrected it.
- Kiro then updated `docs/KIRO_WORKFLOW.md` and `docs/submission/WRITEUP.md` for what PRs #12 and #13 added: the `revival-kit` spec (`f52061d`), the Nov 11 `gravekeeper-review` run (`2026-11-11-review-findings.json`, 5.63 credits; findings fixed, partly fixed or rejected per that file), the two new evidence files, and the hook counts recorded in them. `.kiro/evidence/2026-11-11-judge-guide.json` gained a `followUp` note.
- Checks on the merged tree: `npm test` 44 files, 682 passed; lint; typegen + tsc; build; `demo:verify` (4/12 before, 12/12 after); `npm run e2e` against `npx next start -p 3438`, 16 checks passed, server stopped.

## Nov 11, 2026 — Axe scan of the results panels and /proof verdicts, demo storyboard (Kiro agent session)

Branch `feat/a11y-and-demo-assets-20261111`, from main `f6b7b40`. Evidence: `.kiro/evidence/2026-11-11-a11y-demo-assets.json` (metadata only). The credit figure for this session is recorded by the runner, not here. No token count or WBM record is claimed. No hook output was observed in this session, and no MCP server was used. No video was recorded or uploaded, and no Devpost submission, blog publish or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `scripts/synthetic-lookup.mts` now also signs a `wayback-cdx` capture index, a `package.json` manifest and npm registry results, in the route's receipt order, so the Epitaph, Dependency autopsy and Revival kit panels render with data. `scripts/synthetic-lookup.test.ts` checks that it verifies and is refused after the displayed autopsy is edited.
- `scripts/a11y-audit.mts` scans the synthetic results state twice (collapsed; then all disclosures open, proof verified, kit downloaded and issue-body copy status shown) and `/proof` with a valid and a tampered proof pasted. Each state throws if it is not reached.
- Ran it against a local production build in Chromium 158, Firefox 159 and WebKit 27.2: 0 counted violations in each, plus the same 4 intentional findings on the Lantern Hill "before" fixture. No counted violation was found, so no component was changed and there was no failing test to write for a fix. `scripts/polish-check.mts` with the extended data: 24 tab stops on the results page at 375 and 1440 px, none without visible focus.
- New `npm run e2e` step: keyboard-only path through the Epitaph table, autopsy table region and revival kit (section order, visible focus on each stop in the three panels, Enter and Space on the kit buttons, separate status regions).
- `docs/A11Y_AUDIT.md` gained a section for this pass with its limits; `docs/JUDGES.md`, `docs/submission/DEVPOST.md`, `docs/submission/WRITEUP.md` and `docs/EPITAPH_TIMELINE.md` no longer say the panels were never scanned.
- Copied nine production screenshots (captured 13:16–13:17 UTC before this session, not by this agent) into `docs/screenshots/live/` with captions, renaming one whose viewport shows the Epitaph but not the autopsy. Added one to the README, labelled live production. Wrote `docs/submission/DEMO_STORYBOARD.md` (both cuts, title card, recording checklist) as a draft. Beats with no screenshot are marked "None yet".

**Hand work:** none beyond the prompt. The production screenshots were captured earlier, outside this session.

**Checks:** `npm test` 45 files, 685 passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify` (4/12 before, 12/12 after); `npm run e2e` against `npx next start -p 3467`, 17 checks passed; `npm run a11y` (Chromium) on the same build, 0 counted violations. Server stopped afterwards.

**Limits:** no screen-reader pass. The new panels were scanned with synthetic data only; the live `--lookup` scan was not re-run and contrast was not re-sampled for them. Which copy status Firefox and WebKit showed was not recorded. The polish check and keyboard e2e step ran in Chromium only.

## Nov 11, 2026 — CI install retry, production Lighthouse, accessibility-tree pass (Kiro agent session)

Branch `feat/ci-lighthouse-a11y-tree-20261111`, from main `0d944db`. The credit figure for this session is recorded by the runner, not here. No token count or WBM record is claimed. Evidence: `.kiro/evidence/2026-11-11-ci-lighthouse-a11y-tree.json`. No hook output or MCP call was observed in this session, and none is claimed. No Devpost submission, video, blog publish, or social post was made.

**Kiro-generated (agent wrote and ran these):**
- `.github/workflows/ci.yml`: the browser job's Playwright install now retries `--with-deps` twice (each attempt capped at 150 s) and, if apt still fails, falls back to `npx playwright install chromium`, which has no fallback of its own so a real browser-download failure still fails the job. This was motivated by PR #16's two failed `browser` jobs (apt could not resolve the Ubuntu mirrors). The first version (3 uncapped attempts) hung: with DNS down, apt retried for the whole 20-minute job timeout and the `browser` job was cancelled (run 43041000401). The per-attempt `timeout` was added after that; the YAML was only parsed locally.
- Production Lighthouse 13.6.0 against https://gravekeeper-drab.vercel.app (headless Chrome 157, 3 runs per page, mobile emulation): 100 in every category except `/proof` SEO 92. The cause was a real bug: `/proof` inherited the root `canonical: "/"`. Fixed with a test that failed first; a local production build then scored SEO 100 on `/proof` (one run). The deployed site has not been re-measured since the fix. Details and limits in `docs/LIGHTHOUSE.md`.
- `scripts/a11y-tree.mts` (`npm run a11y:tree`): Chromium ARIA snapshots in `docs/a11y-tree/` for the landing page, a synthetic lookup (collapsed, then everything open with proof verified and the kit used) and `/proof` empty, Valid and Invalid, with structural assertions. It found that receipt summaries were announced as `01wayback3e7e8cd9c226…`; a static-markup test failed first, then the summary parts were spaced. Other observations are listed in `docs/A11Y_AUDIT.md` as not changed. This is an accessibility-tree pass, not a VoiceOver or NVDA pass; no OS accessibility feature was started.
- `docs/JUDGES.md` main SHA updated to `0d944db` with the PRs actually on it; Design limits updated.
- `scripts/capture-storyboard-stills.mts` does not exist on this base (it is in the open PR #16), so the `as never` cast cleanup was not applicable here. `scripts/a11y-audit.mts` still has its own `synthetic as never` cast; it was left alone.

**Hand work:** none beyond the prompt.

**Checks (before the final pull):** `npm test` 45 files, 687 passed; `npm run lint`; `npx next typegen && npx tsc --noEmit`; `npm run build`; `npm run demo:verify` (4/12 before, 12/12 after); `npm run e2e` and `npm run a11y` (Chromium, 0 counted violations) against `npx next start -p 3441`; `npm run a11y:tree` passed. Servers were stopped afterwards. `node_modules` in this worktree was a symlink to another checkout; only the symlink was removed and `npm ci` run locally.

**Limits:** Lighthouse is lab data from one machine and one run window; no CI Lighthouse gate. The tree pass is Chromium only, synthetic data only, and shows what the browser exposes rather than what a screen reader says.
