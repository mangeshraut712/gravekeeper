# How Gravekeeper uses Kiro

A map of every file under `.kiro/`, what it does, and whether it has been seen working. Formats follow the Kiro docs for CLI V3 (kiro-cli 3.2.0): steering front matter, `.kiro/hooks/*.json` v1 hooks, and agent JSON with `permissions` rules.

**Markers.** "Observed" means a record in `.kiro/evidence/` or git history shows it happening. "Configured" means the file exists and parses, with no such record. The session log in `KIRO_USAGE.md` adds context but is not counted as evidence here.

## Steering (`.kiro/steering/`)

| File | Inclusion | Scope | Status |
|---|---|---|---|
| `product.md` | always (no front matter, the default) | product goals, non-goals, success criteria | Observed: listed as loaded context in both 2026-11-11 headless runs |
| `tech.md` | always | stack versions, crypto, fetch rules, env vars | Observed: same |
| `structure.md` | always | directory layout and module conventions | Observed: same |
| `receipts-security.md` | fileMatch: `src/lib/receipts/**`, `src/client/**`, `scripts/verify-proof.ts` | one hash/sign scheme, what the verifier must keep rejecting, evidence binding, exit codes of `verify-proof.ts` | Configured. Not loaded in either run, which is expected: neither touched a matching file |
| `accessibility.md` | fileMatch: `src/components/**`, `src/app/**/*.tsx` | WCAG 2.2 AA rules used here: text not colour alone, focus order, targets, live regions, reduced motion | Observed loaded in the a11y agent run, through that agent's `resources` list (not through fileMatch) |
| `testing.md` | fileMatch: `**/*.test.ts`, `**/*.test.tsx` | Vitest and fast-check conventions, `vi.stubGlobal` fetch mocks, no real HTTP | Configured |
| `release.md` | manual (`#release` or `/release`) | release checks, claim rules, things never to do | Observed registered: the CLI listed `release` as a steering slash command in the 2026-11-11 runs. Not yet invoked |

`AGENTS.md` at the repo root is always included as well.

## Specs (`.kiro/specs/`)

`resurrect/`, the core feature:

- `requirements.md`: 7 user stories (US-01 to US-07) with numbered EARS acceptance criteria.
- `design.md`: architecture, data models, canonical JSON hashing, six correctness properties for fast-check, the `Result<T>` error model.
- `tasks.md`: 17 tasks in 4 phases, each with a **Refs:** line back to the requirements.

Observed: git history shows the spec written first (`863f8c1`, Nov 3) and tasks ticked as code landed (`6805a11`, `0e2c546`, `7b7ddfd`, `0c6e636`, `373ce4b`). Task 16 still has open items.

Later features each have their own `requirements.md`, `design.md` and `tasks.md`, committed before their code:

| Spec | Feature | Committed before code | Record |
|---|---|---|---|
| `dependency-autopsy/` | manifest and registry receipts, version floors, upgrade steps (PR #7) | `e8b6285` | `2026-11-11-dependency-autopsy.json` |
| `epitaph-timeline/` | CDX capture timeline and `/?url=` permalinks (PR #11) | `d44a06d` | `2026-11-11-epitaph-timeline.json` |
| `proof-workbench/` | in-browser `/proof` checker (PR #9) | no: spec and code landed in the same commit, `89a94fa` | `2026-11-11-proof-restoration.json` |
| `revival-kit/` | `REVIVAL.md` and tracking-issue export after a verified lookup (PR #12) | `f52061d` | `2026-11-11-revival-kit.json` |

## Custom agents (`.kiro/agents/`)

| Agent | Tools | Limits | Status |
|---|---|---|---|
| `gravekeeper` | read, write, shell, grep, glob, thinking, todo, introspect, `@github`, `@fetch` | loads steering + resurrect spec + `KIRO_USAGE.md`; includes `mcp.json` | Observed: 2026-11-11 run that exercised the pre-release gate (`.kiro/evidence/2026-11-11-kiro-workflow-depth.json`) |
| `gravekeeper-review` | read, grep, glob | no shell, no write, no MCP | Observed: four review runs (`2026-11-06-review-metering.json`, `2026-11-10-fog-review.json`, `2026-11-11-review-findings.json`) |
| `gravekeeper-a11y` | read, grep, glob, shell | shell allowed for `npm run a11y` and simple reads; `fs_write` denied; rm, git commit/push/reset, npm install, sudo denied | Observed: one run on 2026-11-11, 0.229 credits (`2026-11-11-a11y-agent-run.json`) |
| `gravekeeper-docs` | read, grep, glob, write | `fs_write` allowed only for `docs/**` and `.kiro/specs/**`, denied elsewhere | Configured. `kiro-cli agent validate` passes; not run yet |

All four pass `kiro-cli agent validate` and appear in `kiro-cli agent list`.

## Hooks (`.kiro/hooks/`)

CLI 3.2.0 file hooks fire only for changes the agent makes, not editor saves.

| Hook | Trigger | Matcher | Action | Status |
|---|---|---|---|---|
| `run-src-tests-on-save` | PostFileSave | `src/(lib\|components)/…\.(ts\|tsx)$` | command `npm test` | Configured. Its matching saves were logged, but its output was never attached to a session, so a result is not claimed (`2026-11-11-hook-mcp-exercise.json`) |
| `keep-tasks-md-in-sync` | PostFileSave | `src/(lib\|app)/…` | agent prompt: tick finished tasks | Observed: prompt delivered after `src/` saves in five sessions; it ticked nothing, because no open task was completed (`2026-11-11-hook-mcp-exercise.json`, `-dependency-autopsy.json`, `-epitaph-timeline.json`, `-perf-polish.json`, `-revival-kit.json`) |
| `check-spec-drift` | PostFileSave | `src/(types\|app/api)/…` | agent prompt: update design/tasks if contracts drifted | Observed twice: `resurrect/design.md` was updated after a `src/types/index.ts` save and after a route test save (`-dependency-autopsy.json`, `-epitaph-timeline.json`) |
| `receipts-property-tests-on-save` | PostFileSave | `src/(lib/receipts\|client)/…` | command `npx vitest run src/lib/receipts src/client` | Configured |
| `spec-requirements-coverage` | PostFileSave | `.kiro/specs/*/requirements.md` | agent prompt: every requirement id covered by design.md and tasks.md | Observed twice: fired after `epitaph-timeline/requirements.md` and `revival-kit/requirements.md` were saved; no gaps found (`-epitaph-timeline.json`, `-revival-kit.json`) |
| `pre-release-gate` | PreToolUse | `shell` | command `node scripts/pre-release-gate.mjs`: for `git push` or `gh pr create`, runs `npm test`, `npm run lint`, `npm run demo:verify`; exit 2 blocks the call | Observed: fired in a 2026-11-11 headless run (`hook_update` status `completed`) before a `git push --dry-run`; checks passed, so the call went ahead. The block path was tested by running the script directly, not through Kiro. The command matcher is in `scripts/release-gate-match.mjs` and covered by `scripts/release-gate-match.test.ts`, which was added after review found that multiline and indented pushes slipped past it |

Why the gate is a PreToolUse hook: the Kiro docs say CLI V3 lists `Manual` hooks but `/hooks` cannot invoke them, so a user-triggered release hook would never run from the CLI. A PreToolUse hook on shell commands is the supported way to gate an action.

## MCP (`.kiro/settings/mcp.json`)

- `github`: `@modelcontextprotocol/server-github` via npx; token only through `${GITHUB_TOKEN}`.
- `fetch`: `mcp-server-fetch` via `uvx`. The earlier `@modelcontextprotocol/server-fetch` npx package does not exist on npm, so it was replaced.

Status: both servers were started by a direct stdio probe (`scripts/mcp-probe.mts`, `2026-11-11-hook-mcp-exercise.json`). The fetch server's `fetch` tool returned the Wayback availability JSON for `github.com/atom/atom`. The GitHub server listed 26 tools, but no tool was called because `GITHUB_TOKEN` was unset. No evidence record shows Kiro itself calling an MCP tool in a chat turn. In the 2026-11-11 `gravekeeper` run, MCP tools added 0 tokens to context.

## Powers

None installed or used.

## Evidence (`.kiro/evidence/`)

Metadata only: purpose, agent, session id, provider-reported credits from stream-json, scope and conclusion. Transcripts are not published. Credits are not token counts.

| File | What it records | Credits |
|---|---|---|
| `2026-11-06-review-metering.json` | two read-only reviews | 1.9215 |
| `2026-11-10-fog-review.json` | read-only fog overlay review | 0.4055 |
| `2026-11-11-a11y-agent-run.json` | a11y agent scan of a local production build | 0.2290 |
| `2026-11-11-kiro-workflow-depth.json` | this workflow pass, including the observed pre-release-gate run | 0.3173 (gate run only) |
| `2026-11-11-hook-mcp-exercise.json` | PostFileSave hooks and the two MCP servers exercised once | not exposed |
| `2026-11-11-dependency-autopsy.json` | dependency autopsy session, checks and observed hooks | not exposed |
| `2026-11-11-proof-restoration.json` | proof workbench, restoration properties, fog margin, Lighthouse | not exposed |
| `2026-11-11-perf-polish.json` | Lighthouse before/after, share previews, polish checks | recorded by the runner |
| `2026-11-11-epitaph-timeline.json` | epitaph timeline session, real lookups, observed hooks | not exposed |
| `2026-11-11-revival-kit.json` | revival kit session, checks and observed hooks | recorded by the runner |
| `2026-11-11-review-findings.json` | read-only `gravekeeper-review` pass over code since `9165fa3`, then fixes (PR #13); notes in `docs/reviews/2026-11-11-kiro-review.md` | 5.6345 |
| `2026-11-11-judge-guide.json` | this judge guide and docs pass | recorded by the runner |

## Related checks outside Kiro

- `npm run e2e` (`scripts/e2e-smoke.mts`): Playwright smoke test with a synthetic signed lookup; checks the proof round trip through `scripts/verify-proof.ts`, including a one-byte tamper.
- `npm run a11y` (`scripts/a11y-audit.mts`): axe-core scan; results in `docs/A11Y_AUDIT.md`.
- CI (`.github/workflows/ci.yml`): `verify` job (tests, lint, typecheck, build), then a `browser` job that runs e2e and a11y on Chromium.
