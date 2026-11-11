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
