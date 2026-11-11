# How Kiro was used to build Gravekeeper

DRAFT for judges. Not submitted. Everything below is taken from this repository; the full dated log is [KIRO_USAGE.md](../../KIRO_USAGE.md), and provider-reported credit figures are in [KIRO_USAGE.md](../../KIRO_USAGE.md) and [.kiro/evidence](../../.kiro/evidence).

## Surface: Kiro CLI

The work logged in KIRO_USAGE.md was done with `kiro-cli` (chat sessions, some with `--no-interactive`) on a Mac. The log does not record use of a Kiro IDE surface, so none is claimed. Some code was written by hand outside Kiro; KIRO_USAGE.md says which, session by session. One early session hit the monthly usage limit and wrote nothing; the log records that too.

## Steering docs

`.kiro/steering/product.md`, `tech.md` and `structure.md` were written by Kiro CLI from a one-paragraph pitch. It read the installed packages and pinned real versions (Next.js 16, Tailwind v4, Vitest, fast-check) rather than the versions guessed in the prompt. Later sessions were started with a prompt that says to follow the steering files, and the `gravekeeper` agent lists them as resources. Conventions they fix: `Result<T>` instead of thrown errors in `src/lib`, one receipt hashing scheme, mocked `fetch` in tests, `@/` imports.

## Spec-driven work versus vibe coding

- Spec-driven: the receipt chain and API logic. `.kiro/specs/resurrect/` has `requirements.md` (7 user stories, EARS acceptance criteria), `design.md` (data models, canonical JSON hashing, six correctness properties, error model) and `tasks.md` (17 tasks in 4 phases). Kiro worked through tasks in order and the checkboxes were ticked as they completed (some by hand; see below). The design was later reconciled with shipped behavior (evidence payloads, Lantern Hill export format).
- Spec-driven (Nov 11): the dependency autopsy. `.kiro/specs/dependency-autopsy/` was committed before code (`e8b6285`). For a GitHub repository, the lookup reads the root `package.json`, `requirements.txt` or `pyproject.toml`, asks npm or PyPI for each package's latest version (40 at most), and labels each declaration current, minor behind, major behind, unknown or not found. The manifest and registry answers are signed as `github-manifest` and `registry` receipts, and both verifiers rebuild the displayed table from them. Real runs of `atom/atom` and `facebookarchive/flux` are in `docs/DEPENDENCY_AUTOPSY.md`. Automated reviewers on PR #7 found several version-comparison edge cases (exclusive partials, `!=` prefixes, repeated PyPI requirements, prerelease tags); each was fixed with a failing test first, some by Kiro and some by hand (KIRO_USAGE.md).
- Spec-driven (Nov 11): the Epitaph timeline. `.kiro/specs/epitaph-timeline/` was committed before code (`d44a06d`). Each lookup now reads the Internet Archive CDX index for first capture, last seen and captured months per year, signs it as a `wayback-cdx` receipt that both verifiers rebuild, and results can be shared as `/?url=` permalinks. In a real production-build run, `atom/atom` gave a 2014–2026 timeline; the `www.geocities.com` index did not answer within the 10-second limit, and the panel showed that error (`docs/EPITAPH_TIMELINE.md`).
- The `/proof` workbench has a spec in `.kiro/specs/proof-workbench/`, but it landed in the same commit as the code (`89a94fa`), so it is not claimed as spec-first.
- Less spec-driven: UI polish and the haunted-graveyard look. The log planned this as vibe coding; the UI was later consolidated and then split into components under task 10-15, and much of the visual work, the first workbench interface, URL validation and the operator-only fork guard were implemented outside Kiro (KIRO_USAGE.md, Nov 6 entry).

## Custom agents

All four are in `.kiro/agents/` and pass `kiro-cli agent validate` (`docs/KIRO_WORKFLOW.md`).

- `gravekeeper`: the implementation agent. Resources are the steering files, the three spec files and KIRO_USAGE.md; tools include read/write/shell/grep/glob and `@fetch`/`@github`; `includeMcpJson` is true. Its prompt restates the repo rules (Result, single hashing scheme, mocked fetch, no secrets, no co-author trailers, no Devpost submission).
- `gravekeeper-review`: read-only (glob, grep, read; no shell, no write, no MCP). Used for bounded source reviews. Three reviews are logged: two on Nov 6 and one on Nov 10 (fog overlay). They did not run tests or change files.
- `gravekeeper-a11y`: read plus a shell limited to `npm run a11y` and simple reads; file writes denied. One observed run on Nov 11 scanned a local production build (`.kiro/evidence/2026-11-11-a11y-agent-run.json`, 0.229 credits).
- `gravekeeper-docs`: writes allowed only under `docs/**` and `.kiro/specs/**`. Configured and validated; no run is recorded.

What the reviews found, per the log: error payload digests that could distinguish a private repo from a missing one (fixed, with fixed error codes in receipts); a first proof verifier that checked signatures and links but not the displayed result data (fixed with per-receipt evidence and regression tests); a remaining 403-versus-404 distinction (fixed afterward); and a suggestion to tighten a fog-overlay test (done). A later attempted review was blocked by the execution environment before completing; no result is claimed.

## Agent hooks

Six hooks in five files are in `.kiro/hooks/` (table and matchers in `docs/KIRO_WORKFLOW.md`):

- `run-tests-on-save.json`: `run-src-tests-on-save`, a command hook running `npm test` on `PostFileSave` for `src/(lib|components)/*.ts(x)`.
- `keep-tasks-in-sync.json`: two agent-prompt hooks, `keep-tasks-md-in-sync` (tick matching boxes in `tasks.md` after `src/lib` or `src/app` edits) and `check-spec-drift` (check design/tasks drift after `src/types` or `src/app/api` edits).
- `receipts-property-tests-on-save.json`: runs the receipt and proof tests when those files change.
- `spec-requirements-coverage.json`: an agent prompt that checks every requirement id is covered by design and tasks after a `requirements.md` save.
- `pre-release-gate.json`: a `PreToolUse` hook on shell commands that runs tests, lint and `demo:verify` before `git push` or `gh pr create`, and blocks on failure.

Configuration alone is not execution evidence. What the evidence files record:

- `keep-tasks-md-in-sync` delivered its prompt after `src/` saves in four sessions (`2026-11-11-hook-mcp-exercise.json`, `-dependency-autopsy.json`, `-epitaph-timeline.json`, `-perf-polish.json`). It never ticked a box, because none of those changes completed an open task.
- `check-spec-drift` fired twice and `.kiro/specs/resurrect/design.md` was updated each time (new receipt kinds and response fields for the autopsy and the timeline).
- `spec-requirements-coverage` fired once, after the epitaph requirements were saved, and found no gaps.
- `pre-release-gate` fired once before a `git push --dry-run`; the checks passed, so the call went ahead (`2026-11-11-kiro-workflow-depth.json`). The blocking path was tested by running the script directly, not through Kiro.
- The `npm test` command hook's output was never attached to a session, so its result is not claimed; the suite was run by hand each time. `receipts-property-tests-on-save` has no recorded run.

## MCP

`.kiro/settings/mcp.json` configures two servers: `@modelcontextprotocol/server-github` via `npx` (token only via `${GITHUB_TOKEN}`; no secret is stored in the repo) and a fetch server. Both have empty `autoApprove`. Checking them on Nov 11 found that the configured fetch package, `@modelcontextprotocol/server-fetch`, does not exist on npm, so it could never have started; the config now uses `uvx mcp-server-fetch`. With a small stdio client (`scripts/mcp-probe.mts`), the fetch server started, listed its `fetch` tool, and returned the Wayback availability JSON for `github.com/atom/atom`. The GitHub server started and listed 26 tools, but `GITHUB_TOKEN` was not set, so no GitHub tool was called. These probes show the configured servers work; they are not Kiro invoking an MCP tool in a chat turn, and no such call is claimed. The read-only review agent has `includeMcpJson: false`.

## Property-based tests (fast-check)

`src/lib/receipts/chain.test.ts` and `crypto.test.ts` check the design properties: sign/verify round trip, tampered data failing verification, canonical JSON being key-order independent (plus a UTF-8 round trip), chain integrity for built chains, tamper detection when a receipt field is mutated, and sequence monotonicity. `src/lib/spec/generator.test.ts` runs 200-run properties (never throws, at least three steps, ordered step numbers, deterministic output, valid ISO timestamp). Later features added their own properties: the version-floor comparator (`src/lib/deps/semver.test.ts`), CDX timeline aggregation (sums, contiguous sorted years, first ≤ last, parser and validator agreement) and the permalink round trip.

The only generator-related problem the log records: `fc.date()` produced `Invalid Date` objects in fast-check v4, so dates are generated from integer timestamps. The log does not say a property test found a real defect in the product code, and I am not claiming one. The Nov 7 log notes a later change narrowed an over-broad Unicode property-test claim in the restoration work. The full test count at the last recorded checkpoints is in `docs/RELEASE_CHECKLIST.md` and KIRO_USAGE.md; on the judge-guide branch (`main` at `129c301` plus docs) `npm test` ran 41 files and 626 tests, all passing.

## Powers and Crew

Kiro powers: not used. Kiro Crew: not used. Nothing in the repo or the log refers to either.

## Credits

Provider-reported credit figures are recorded for several sessions (two read-only reviews totaling about 1.92 credits, the fog review 0.41, the a11y agent run 0.23, the pre-release-gate run 0.32, and later CLI sessions of 2.22, 4.77 and 2.39 credits). Several sessions record none, and for the latest ones the figure is recorded by the runner rather than in the repo. These are credits from CLI metadata, not token counts, and no WBM upload was performed. See KIRO_USAGE.md and `.kiro/evidence/*.json`.

## Limits worth stating

- The revival plan is built from public metadata and the declared versions in one root manifest. It is not a lockfile, transitive-dependency or vulnerability audit.
- Receipts prove internal consistency, not authorship or that GitHub, the Internet Archive or a registry said what they say.
- Accessibility: axe scans found no violations on the product pages scanned in Chromium, Firefox and WebKit (identical counts; the intentionally broken "before" fixture is excluded from the count). Those scans predate the Epitaph and autopsy panels, which have static-markup tests but no recorded axe scan. Color contrast over the fog is "needs review" in axe and was re-measured per text box in Chromium (lowest 7.13:1 in the sampled frames, with caveats in the audit); no screen reader pass was done. See [docs/A11Y_AUDIT.md](../A11Y_AUDIT.md).

## Addendum: proof checker, restoration properties, performance (Nov 11)

- `/proof` lets a visitor open a downloaded proof file and verify it in the browser. Nothing is uploaded; it reuses the same receipt and proof code and shows valid, invalid, and unreadable-file states. Valid still means only internal consistency. Specified under `.kiro/specs/proof-workbench/`. Exercised in headless Chromium (file input, tamper, bad JSON, paste, a synthetic drop event); a real OS drag and a screen reader were not tested.
- Added fast-check properties for the restoration `reverse()` and `compareVersions()` that I believe hold (length and code-unit preservation, no throw, concatenation on a plain alphabet). The documented non-involution on leading combining marks stands.
- The fog alphas were lowered and a test now checks the worst-case contrast from the CSS. The fog-only sweep did not reproduce the earlier `#55514c` reading with the old CSS (old peak `#292a23`, 5.60:1), so this is a safety margin rather than a confirmed failure fix.
- Lighthouse (local production build, mobile emulation, median of 3): 100 in all four categories on `/`, `/restoration`, `/lantern-hill`, `/proof`, after fixing a footer layout shift on `/lantern-hill`. Lab numbers only; the deployed site was not measured. See `docs/LIGHTHOUSE.md`.

- Share previews (PR #10): 1200×630 Open Graph and Twitter images, canonical URLs, `robots.txt` and `sitemap.xml`. Before/after Lighthouse runs with Lighthouse 12.8.2 are in `docs/PERFORMANCE.md`. Scores were already 98 to 100 and did not move beyond run spread. The polish check fixed a results layout shift (0.0554 to 0.0004 at 375 px) and missing focus rings on the Lantern Hill preview frames. Rendering on real social networks was not checked.

## Not on `main`

PR #12 (a revival kit: `REVIVAL.md` and a tracking issue from a verified lookup) is open and not merged. It is not described here as a feature.
