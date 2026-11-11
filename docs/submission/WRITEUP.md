# How Kiro was used to build Gravekeeper

DRAFT for judges. Not submitted. Everything below is taken from this repository; the full dated log is [KIRO_USAGE.md](../../KIRO_USAGE.md), and provider-reported credit figures are in [KIRO_USAGE.md](../../KIRO_USAGE.md) and [.kiro/evidence](../../.kiro/evidence).

## Surface: Kiro CLI

The work logged in KIRO_USAGE.md was done with `kiro-cli` (chat sessions, some with `--no-interactive`) on a Mac. The log does not record use of a Kiro IDE surface, so none is claimed. Some code was written by hand outside Kiro; KIRO_USAGE.md says which, session by session. One early session hit the monthly usage limit and wrote nothing; the log records that too.

## Steering docs

`.kiro/steering/product.md`, `tech.md` and `structure.md` were written by Kiro CLI from a one-paragraph pitch. It read the installed packages and pinned real versions (Next.js 16, Tailwind v4, Vitest, fast-check) rather than the versions guessed in the prompt. Later sessions were started with a prompt that says to follow the steering files, and the `gravekeeper` agent lists them as resources. Conventions they fix: `Result<T>` instead of thrown errors in `src/lib`, one receipt hashing scheme, mocked `fetch` in tests, `@/` imports.

## Spec-driven work versus vibe coding

- Spec-driven: the receipt chain and API logic. `.kiro/specs/resurrect/` has `requirements.md` (7 user stories, EARS acceptance criteria), `design.md` (data models, canonical JSON hashing, six correctness properties, error model) and `tasks.md` (17 tasks in 4 phases). Kiro worked through tasks in order and the checkboxes were ticked as they completed (some by hand; see below). The design was later reconciled with shipped behavior (evidence payloads, Lantern Hill export format).
- Less spec-driven: UI polish and the haunted-graveyard look. The log planned this as vibe coding; the UI was later consolidated and then split into components under task 10-15, and much of the visual work, the first workbench interface, URL validation and the operator-only fork guard were implemented outside Kiro (KIRO_USAGE.md, Nov 6 entry).

## Custom agents

Both are in `.kiro/agents/`.

- `gravekeeper`: the implementation agent. Resources are the steering files, the three spec files and KIRO_USAGE.md; tools include read/write/shell/grep/glob and `@fetch`/`@github`; `includeMcpJson` is true. Its prompt restates the repo rules (Result, single hashing scheme, mocked fetch, no secrets, no co-author trailers, no Devpost submission).
- `gravekeeper-review`: read-only (glob, grep, read; no shell, no write, no MCP). Used for bounded source reviews. Three reviews are logged: two on Nov 6 and one on Nov 10 (fog overlay). They did not run tests or change files.

What the reviews found, per the log: error payload digests that could distinguish a private repo from a missing one (fixed, with fixed error codes in receipts); a first proof verifier that checked signatures and links but not the displayed result data (fixed with per-receipt evidence and regression tests); a remaining 403-versus-404 distinction (fixed afterward); and a suggestion to tighten a fog-overlay test (done). A later attempted review was blocked by the execution environment before completing; no result is claimed.

## Agent hooks

Configured in `.kiro/hooks/`:

- `run-tests-on-save.json`: on `PostFileSave` for `src/(lib|components)/*.ts(x)`, runs `npm test`.
- `keep-tasks-in-sync.json`: two agent-prompt hooks on `PostFileSave`: tick matching boxes in `tasks.md` after `src/lib` or `src/app` edits, and check design/tasks drift after `src/types` or `src/app/api` edits.

Configuration alone is not execution evidence. What was observed, once, on Nov 11 (details in `.kiro/evidence/2026-11-11-hook-mcp-exercise.json`): saving `src/lib/wayback/client.test.ts` made the `keep-tasks-md-in-sync` agent hook deliver its prompt to the session, and the Kiro log recorded two hook-invocation events for that save. The agent hook checked `tasks.md` and ticked nothing, because the new test completed no task. The output of the `npm test` command hook was not attached to the session, so its result was not observed; the suite was run by hand (225 passing). Earlier, KIRO_USAGE.md has one remark that a post-save hook "found no `tasks.md` item that this completes" (Nov 7). That is the whole record: two sessions where a hook is known to have fired.

## MCP

`.kiro/settings/mcp.json` configures two servers: `@modelcontextprotocol/server-github` via `npx` (token only via `${GITHUB_TOKEN}`; no secret is stored in the repo) and a fetch server. Both have empty `autoApprove`. Checking them on Nov 11 found that the configured fetch package, `@modelcontextprotocol/server-fetch`, does not exist on npm, so it could never have started; the config now uses `uvx mcp-server-fetch`. With a small stdio client (`scripts/mcp-probe.mts`), the fetch server started, listed its `fetch` tool, and returned the Wayback availability JSON for `github.com/atom/atom`. The GitHub server started and listed 26 tools, but `GITHUB_TOKEN` was not set, so no GitHub tool was called. These probes show the configured servers work; they are not Kiro invoking an MCP tool in a chat turn, and no such call is claimed. The read-only review agent has `includeMcpJson: false`.

## Property-based tests (fast-check)

`src/lib/receipts/chain.test.ts` and `crypto.test.ts` check the design properties: sign/verify round trip, tampered data failing verification, canonical JSON being key-order independent (plus a UTF-8 round trip), chain integrity for built chains, tamper detection when a receipt field is mutated, and sequence monotonicity. `src/lib/spec/generator.test.ts` runs 200-run properties (never throws, at least three steps, ordered step numbers, deterministic output, valid ISO timestamp).

The only generator-related problem the log records: `fc.date()` produced `Invalid Date` objects in fast-check v4, so dates are generated from integer timestamps. The log does not say a property test found a real defect in the product code, and I am not claiming one. The Nov 7 log notes a later change narrowed an over-broad Unicode property-test claim in the restoration work. The full test count at the last recorded checkpoints is in `docs/RELEASE_CHECKLIST.md` and KIRO_USAGE.md; re-run `npm test` for the current number.

## Powers and Crew

Kiro powers: not used. Kiro Crew: not used. Nothing in the repo or the log refers to either.

## Credits

Provider-reported credit figures are recorded for several sessions (two read-only reviews totaling about 1.92 credits, the fog review 0.41, and later CLI sessions of 2.22 and 4.77 credits), and several sessions record none. These are credits from CLI metadata, not token counts, and no WBM upload was performed. See KIRO_USAGE.md and `.kiro/evidence/*.json`.

## Limits worth stating

- The revival plan is built from public metadata, not a code or dependency audit.
- Receipts prove internal consistency, not authorship or that GitHub/the Internet Archive said what they say.
- Accessibility: axe scans found no violations on the product pages scanned in Chromium, Firefox and WebKit (identical counts; the intentionally broken "before" fixture is excluded from the count). Color contrast over the fog is "needs review" in axe and was re-measured per text box in Chromium (lowest 7.13:1 in the sampled frames, with caveats in the audit); no screen reader pass was done. See [docs/A11Y_AUDIT.md](../A11Y_AUDIT.md).
