# Revival kit

After a lookup, the results page has a **Take the plan home** section with two buttons:

- **Download revival kit** saves `REVIVAL.md`: repository facts, the archive snapshot link, the five most recent commits, every revival plan step, the dependency autopsy table (if present), the Epitaph timeline (if present), a ready-to-paste "Revival tracking issue", and a proof reference.
- **Copy issue body** copies only the "Revival tracking issue" text: one `- [ ]` checkbox per plan step, the snapshot link and the proof SHA-256. It is byte-identical to the issue section inside `REVIVAL.md`.

Spec: `.kiro/specs/revival-kit/`. Code: `src/lib/revival/markdown.ts` (pure generator), `src/client/kit.ts` (verify, hash, build), `src/components/RevivalKitPanel.tsx`.

## How it is tied to the proof

Both buttons first run the same browser check as **Verify proof** (`verifyProof(result, url)`). If it fails, nothing is downloaded or copied, and the status region says "Revival kit not created: the proof did not verify." (or "Issue body not copied: …").

The kit names the SHA-256 of the exact bytes that **Download proof** writes (`exportProof(result, url)`, hashed with the project's `sha256hex`). A maintainer can check the pairing with `shasum -a 256 gravekeeper-proof.json` and then run `node scripts/verify-proof.ts gravekeeper-proof.json`.

Limits: this ties the plan to Gravekeeper's signed receipts. It does not show that GitHub, the package registries or the Internet Archive returned true data, it is not a new signature over the kit, and the kit is only as complete as the lookup (the autopsy reads the root manifest only; no source or vulnerability audit).

## Escaping

Repository descriptions, commit messages, author names, package names and versions, plan steps (which embed package names), error codes and the resource URL are user-controlled. Each one passes through `escapeMarkdown()` once:

- `&`, `<`, `>` become `&amp;`, `&lt;`, `&gt;`, so no HTML is emitted. The generator never writes `<` or `>` itself.
- `` \ ` * _ [ ] ( ) # ! | ~ @ $ `` get a backslash, so input cannot create links, images, code, emphasis, table cells, `@mentions`, `#123` references or math.
- Line breaks, controls, Unicode line separators and bidi controls become spaces, and user text never starts a line, so input cannot open a heading, list or block.
- Only two links are generated: the snapshot (`web.archive.org` only, parentheses percent-encoded) and `https://github.com/<owner>/<repo>` with percent-encoded segments.

Unit tests and fast-check properties are in `src/lib/revival/markdown.test.ts`; `src/client/kit.test.ts` covers verification refusal; `scripts/e2e-smoke.mts` has a download/copy case and a tampered-response refusal case.

## Real example: facebookarchive/flux

What was run (Nov 11, 2026):

- Local production build (`npm run build`, then `npx next start -p 3400`), `GITHUB_TOKEN` and `FORK_API_SECRET` unset.
- A Playwright (Chromium) script typed `https://github.com/facebookarchive/flux` into the form, clicked **Verify proof**, **Download proof**, **Download revival kit** and **Copy issue body**.
- `/api/resurrect` returned HTTP 200 in about 9.0 s. Lookup recorded at `2026-11-11T12:22:39.827Z`. Receipts: `wayback, wayback-cdx, github-meta, github-commits, github-manifest, registry, spec` (7).
- Browser verification: "Proof internally consistent". `node scripts/verify-proof.ts gravekeeper-proof.json`: "Internally consistent: 7 receipts and their evidence verified.", exit 0.
- SHA-256 of the downloaded proof file: `c853324fe253ce46d5c8d4ec1fe55e25acf45a0a8e67da1d3b51f6f5a6d7f033`. That value appears in `REVIVAL.md`, and the copied issue body is an exact substring of `REVIVAL.md`.

Upstream data changes over time; a new lookup will give different counts, versions and hashes. The proof file itself is not committed here.

The exported `REVIVAL.md`, unedited:

`````markdown
# Revival plan: facebookarchive/flux

Generated in the browser by Gravekeeper from a verified lookup of https://github.com/facebookarchive/flux recorded at 2026-11-11T12:22:39.827Z. Nothing in this file was fetched again; it repeats the data the proof signs. The plan uses repository metadata and declared dependency versions only. It is not a source code or security audit.

## Repository facts

| Fact | Value |
| --- | --- |
| Repository | [facebookarchive/flux](https://github.com/facebookarchive/flux) |
| Description | Application Architecture for Building User Interfaces |
| Last push | 2023-03-21T23:41:43Z |
| Stars | 17434 |
| Forks | 3364 |
| Open issues / PRs | 6 |
| License | NOASSERTION |
| Default branch | main |
| Archived on GitHub | Yes |

## Archive snapshot

- [Wayback Machine capture of 2026-09-28T04:31:56Z](https://web.archive.org/web/20260928043156/https://github.com/facebookarchive/flux)

## Recent commits

- `4ee8c50` 2023-03-21T23:35:18Z, Yangshun: 4.0.4
- `d358d73` 2023-03-21T08:38:11Z, Yangshun Tay: misc: update logo in README.md
- `a925a44` 2023-03-21T07:01:38Z, Yangshun: misc: prepare repo for archiving. it has been a good run\~
- `adea259` 2023-03-21T05:57:50Z, dependabot\[bot\]: build\(deps\): bump dns-packet from 5.3.1 to 5.4.0 in /website \(\#577\)
- `c5980a3` 2023-03-15T12:51:44Z, dependabot\[bot\]: build\(deps\): bump \@sideway/formula from 3.0.0 to 3.0.1 in /website \(\#579\)

Showing 5 of 20 commits in the lookup.

## Revival plan

Detected languages: JavaScript. Framework: React.

1. **Fork and clone the repository.** Fork facebookarchive/flux to your GitHub account and clone it locally. Create a new branch \(e.g. "revival"\) to track your changes.
2. **Update the README.** Replace or supplement the existing README with a revival notice. Document the original purpose, the revival date, and your plans for the project. Add badges for build status and license.
3. **Upgrade \@babel/core ^7.12.10 → 8.x \(major behind\).** package.json declares \@babel/core ^7.12.10; the registry's latest is 8.1.0. Read the changelog for breaking changes between 7.x and 8.x, upgrade on a branch, and run the tests.
4. **Upgrade babel-loader ^8.1.0 → 10.x \(major behind\).** package.json declares babel-loader ^8.1.0; the registry's latest is 10.1.1. Read the changelog for breaking changes between 8.x and 10.x, upgrade on a branch, and run the tests.
5. **Upgrade del ^2.2.0 → 9.x \(major behind\).** package.json declares del ^2.2.0; the registry's latest is 9.0.1. Read the changelog for breaking changes between 2.x and 9.x, upgrade on a branch, and run the tests.
6. **Upgrade gulp ^4.0.2 → 5.x \(major behind\).** package.json declares gulp ^4.0.2; the registry's latest is 5.0.1. Read the changelog for breaking changes between 4.x and 5.x, upgrade on a branch, and run the tests.
7. **Upgrade gulp-header 1.8.2 → 2.x \(major behind\).** package.json declares gulp-header 1.8.2; the registry's latest is 2.0.12. Read the changelog for breaking changes between 1.x and 2.x, upgrade on a branch, and run the tests.
8. **Upgrade 9 more major-behind packages.** Also a major release behind: gulp-rename ^1.2.2 → 2.1.0, immutable ^3.7.4 → 5.1.10, jest ^28.1.0 → 30.5.2, jest-environment-jsdom ^28.1.0 → 30.5.2, react ^17.0.1 → 19.3.1, react-dom ^17.0.1 → 19.3.1, vinyl-source-stream ^1.0.0 → 2.0.0, webpack ^1.11.0 → 5.112.2, webpack-stream ^3.1.0 → 7.0.0.
9. **Update 6 minor-behind packages.** Same major line, older floor: fbjs ^3.0.1 → 3.0.5, babel-preset-fbjs ^3.3.0 → 3.4.0, gulp-babel ^8.0.0 → 8.1.0, gulp-flatten ^0.2.0 → 0.4.0, gulp-util ^3.0.6 → 3.0.8, object-assign ^4.0.1 → 4.1.1. These are usually low-risk; raise the declared floor and refresh the lockfile.
10. **Set up continuous integration.** Add or restore a CI workflow \(GitHub Actions, CircleCI, etc.\) that runs tests on every push. A minimal \`.github/workflows/ci.yml\` that installs dependencies and runs the test suite is sufficient to start.
11. **Triage the 6 open issues.** Review open issues to identify quick wins, stale reports, and blockers. Close duplicates and issues that are no longer relevant. Label the rest by severity so new contributors can orient quickly.
12. **Communicate revival intent.** The last commit was approximately 44 months ago. Post a brief "revival notice" in the project's issue tracker and \(if applicable\) package registry listing. Mention the transfer/fork so existing users know where to find updates.

## Dependency autopsy

Declared versions in package.json compared with the latest npm release. Declared versions only: no lockfile, no install, not a vulnerability scan.

| Package | Group | Declared | Latest | Status | Note |
| --- | --- | --- | --- | --- | --- |
| fbemitter | dependencies | ^3.0.0 | 3.0.0 | Current |  |
| fbjs | dependencies | ^3.0.1 | 3.0.5 | Minor behind |  |
| \@babel/core | devDependencies | ^7.12.10 | 8.1.0 | Major behind |  |
| babel-loader | devDependencies | ^8.1.0 | 10.1.1 | Major behind |  |
| babel-preset-fbjs | devDependencies | ^3.3.0 | 3.4.0 | Minor behind |  |
| del | devDependencies | ^2.2.0 | 9.0.1 | Major behind |  |
| gulp | devDependencies | ^4.0.2 | 5.0.1 | Major behind |  |
| gulp-babel | devDependencies | ^8.0.0 | 8.1.0 | Minor behind |  |
| gulp-flatten | devDependencies | ^0.2.0 | 0.4.0 | Minor behind |  |
| gulp-header | devDependencies | 1.8.2 | 2.0.12 | Major behind |  |
| gulp-rename | devDependencies | ^1.2.2 | 2.1.0 | Major behind |  |
| gulp-util | devDependencies | ^3.0.6 | 3.0.8 | Minor behind |  |
| immutable | devDependencies | ^3.7.4 | 5.1.10 | Major behind |  |
| jest | devDependencies | ^28.1.0 | 30.5.2 | Major behind |  |
| jest-environment-jsdom | devDependencies | ^28.1.0 | 30.5.2 | Major behind |  |
| object-assign | devDependencies | ^4.0.1 | 4.1.1 | Minor behind |  |
| react | devDependencies | ^17.0.1 | 19.3.1 | Major behind |  |
| react-addons-test-utils | devDependencies | ^15.6.2 | 15.6.2 | Current |  |
| react-dom | devDependencies | ^17.0.1 | 19.3.1 | Major behind |  |
| vinyl-source-stream | devDependencies | ^1.0.0 | 2.0.0 | Major behind |  |
| webpack | devDependencies | ^1.11.0 | 5.112.2 | Major behind |  |
| webpack-stream | devDependencies | ^3.1.0 | 7.0.0 | Major behind |  |

## Epitaph timeline

- Born (first capture): 2023-04-23
- Last seen (latest captured month): 2026-09
- Years on record: 4 (4 with captures)
- Captured months: 32

| Year | Months with a capture |
| --- | --- |
| 2023 | 7 |
| 2024 | 9 |
| 2025 | 9 |
| 2026 | 7 |

## Revival tracking issue

Paste everything between the two rules into a new GitHub issue titled "Revival tracking issue".

---

### Revival tracking issue

Tracking the revival of facebookarchive/flux. Plan generated by Gravekeeper from a verified lookup recorded at 2026-11-11T12:22:39.827Z.

#### Tasks

- [ ] 1. Fork and clone the repository: Fork facebookarchive/flux to your GitHub account and clone it locally. Create a new branch \(e.g. "revival"\) to track your changes.
- [ ] 2. Update the README: Replace or supplement the existing README with a revival notice. Document the original purpose, the revival date, and your plans for the project. Add badges for build status and license.
- [ ] 3. Upgrade \@babel/core ^7.12.10 → 8.x \(major behind\): package.json declares \@babel/core ^7.12.10; the registry's latest is 8.1.0. Read the changelog for breaking changes between 7.x and 8.x, upgrade on a branch, and run the tests.
- [ ] 4. Upgrade babel-loader ^8.1.0 → 10.x \(major behind\): package.json declares babel-loader ^8.1.0; the registry's latest is 10.1.1. Read the changelog for breaking changes between 8.x and 10.x, upgrade on a branch, and run the tests.
- [ ] 5. Upgrade del ^2.2.0 → 9.x \(major behind\): package.json declares del ^2.2.0; the registry's latest is 9.0.1. Read the changelog for breaking changes between 2.x and 9.x, upgrade on a branch, and run the tests.
- [ ] 6. Upgrade gulp ^4.0.2 → 5.x \(major behind\): package.json declares gulp ^4.0.2; the registry's latest is 5.0.1. Read the changelog for breaking changes between 4.x and 5.x, upgrade on a branch, and run the tests.
- [ ] 7. Upgrade gulp-header 1.8.2 → 2.x \(major behind\): package.json declares gulp-header 1.8.2; the registry's latest is 2.0.12. Read the changelog for breaking changes between 1.x and 2.x, upgrade on a branch, and run the tests.
- [ ] 8. Upgrade 9 more major-behind packages: Also a major release behind: gulp-rename ^1.2.2 → 2.1.0, immutable ^3.7.4 → 5.1.10, jest ^28.1.0 → 30.5.2, jest-environment-jsdom ^28.1.0 → 30.5.2, react ^17.0.1 → 19.3.1, react-dom ^17.0.1 → 19.3.1, vinyl-source-stream ^1.0.0 → 2.0.0, webpack ^1.11.0 → 5.112.2, webpack-stream ^3.1.0 → 7.0.0.
- [ ] 9. Update 6 minor-behind packages: Same major line, older floor: fbjs ^3.0.1 → 3.0.5, babel-preset-fbjs ^3.3.0 → 3.4.0, gulp-babel ^8.0.0 → 8.1.0, gulp-flatten ^0.2.0 → 0.4.0, gulp-util ^3.0.6 → 3.0.8, object-assign ^4.0.1 → 4.1.1. These are usually low-risk; raise the declared floor and refresh the lockfile.
- [ ] 10. Set up continuous integration: Add or restore a CI workflow \(GitHub Actions, CircleCI, etc.\) that runs tests on every push. A minimal \`.github/workflows/ci.yml\` that installs dependencies and runs the test suite is sufficient to start.
- [ ] 11. Triage the 6 open issues: Review open issues to identify quick wins, stale reports, and blockers. Close duplicates and issues that are no longer relevant. Label the rest by severity so new contributors can orient quickly.
- [ ] 12. Communicate revival intent: The last commit was approximately 44 months ago. Post a brief "revival notice" in the project's issue tracker and \(if applicable\) package registry listing. Mention the transfer/fork so existing users know where to find updates.

#### Evidence

- Archive snapshot: [Wayback Machine capture of 2026-09-28T04:31:56Z](https://web.archive.org/web/20260928043156/https://github.com/facebookarchive/flux)
- Proof file: `gravekeeper-proof.json`, SHA-256 `c853324fe253ce46d5c8d4ec1fe55e25acf45a0a8e67da1d3b51f6f5a6d7f033`
- Integrity only: a valid proof shows these receipts are internally consistent under the key in the file. It does not prove authorship, that GitHub, the package registries or the Internet Archive were truthful, or that later receipts were not removed.

---

## Proof reference

This plan was generated from a lookup whose proof verified in the browser. Download the proof with "Download proof" on the same results page and keep it next to this file.

- Proof file: `gravekeeper-proof.json`
- Proof SHA-256: `c853324fe253ce46d5c8d4ec1fe55e25acf45a0a8e67da1d3b51f6f5a6d7f033`
- Receipts: 7
- Last receipt hash: `1616cbf74762fae603d79eab626708803a2abc1d19c7791b726b698d5e34f429`
- Public key (Ed25519, base64url): `9APgQIXkdyo9SPCHsxm1G_28Us_iqbpTvaTZh-x4jEs`

Check that the proof file is the one this plan refers to, then verify it offline from a Gravekeeper checkout:

```sh
shasum -a 256 gravekeeper-proof.json
node scripts/verify-proof.ts gravekeeper-proof.json
```

Integrity only: a valid proof shows these receipts are internally consistent under the key in the file. It does not prove authorship, that GitHub, the package registries or the Internet Archive were truthful, or that later receipts were not removed.
`````
