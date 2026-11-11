---
inclusion: manual
---

# Release checklist and claim rules

Include with `#release` (or `/release`) when preparing a release commit, a PR description, or submission text. The full gate list is in `docs/RELEASE_CHECKLIST.md`; this file is the short operating version.

## Checks on the exact release commit

1. `npm ci`
2. `npm test`
3. `npm run lint`
4. `npx next typegen && npx tsc --noEmit`
5. `npm run build`
6. `npm run demo:verify` (12/12 modernized vs 4/12 pinned esrever)
7. With `npx next start -p 3300` running: `BASE_URL=http://localhost:3300 npm run e2e` and `BASE_URL=http://localhost:3300 npm run a11y`
8. Smoke-test the deployed URL (https://gravekeeper-drab.vercel.app) after deploy: one GitHub lookup, Verify proof, Download proof, `node scripts/verify-proof.ts` on the file.

Record what ran, at which commit, and the counts in `docs/RELEASE_CHECKLIST.md`. If a step was skipped, say so.

## Claim rules

- Only claim what was run and observed. "Configured" is not "ran". A hook file or MCP entry in `.kiro/` is not evidence that it executed; evidence lives in `.kiro/evidence/` and git history.
- Credits come from Kiro CLI stream-json `meteringUsage`. Report them as provider-reported credits, never as token counts. If a session exposed no figure, say none is available.
- Proof verification means internal consistency under the embedded key. Do not describe it as proof of authorship, provenance, or upstream truth.
- Accessibility: report the axe counts per scanned state from `docs/A11Y_AUDIT.md`. Do not claim zero WCAG violations overall, screen-reader support, or non-Chromium results unless those were tested.
- Synthetic data (e2e and screenshot mocks such as `example/abandoned-widget`) is labelled synthetic wherever it appears.
- Kiro-generated vs hand-written work is stated per session in `KIRO_USAGE.md`.

## Never do

- Submit on Devpost, publish the blog, post on social media, or upload the video. Those are the owner's actions.
- Force-push, amend pushed commits, `git reset --hard`, or delete branches.
- Merge PRs without the owner's go-ahead.
- Configure `GITHUB_TOKEN` write scopes or `FORK_API_SECRET` on the public deployment, prefix secrets with `NEXT_PUBLIC_`, or print secret values.
- Add `Co-authored-by` trailers or skip hooks with `--no-verify`.
- Gitignore or delete `/.kiro`.
