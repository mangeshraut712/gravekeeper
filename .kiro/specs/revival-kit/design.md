# Revival Kit — Design

## Data flow

```
Browser, after a lookup (ResurrectResponse already in memory)
  click "Download revival kit" | "Copy issue body"
    └─ prepareRevivalKit(result, url)                 src/client/kit.ts
         ├─ verifyProof(result, url)                  existing; false → { ok: false, reason: 'unverified' }
         ├─ proofSha256 = sha256hex(utf8(exportProof(result, url)))   existing chain.ts helper, no second scheme
         ├─ issueBody   = buildIssueBody(input)       src/lib/revival/markdown.ts (pure)
         └─ markdown    = buildRevivalMarkdown(input) src/lib/revival/markdown.ts (pure, embeds issueBody verbatim)
    download → Blob('text/markdown;charset=utf-8') named REVIVAL.md
    copy     → navigator.clipboard.writeText(issueBody)
```

No network, no server route, no new dependency. The proof hash is over the same bytes the "Download proof" button writes, because both call `exportProof(result, url)` and `JSON.stringify` is deterministic for the same object.

## Modules

| File | Kind | Exports |
|---|---|---|
| `src/lib/revival/markdown.ts` | pure, isomorphic, no React, no env, no IO | `escapeMarkdown(value, max?)`, `buildIssueBody(input)`, `buildRevivalMarkdown(input)`, `KIT_FILENAME`, `PROOF_FILENAME`, type `RevivalKitInput` |
| `src/client/kit.ts` | browser-safe | `prepareRevivalKit(result, url) → Promise<RevivalKitResult>` |
| `src/components/RevivalKitPanel.tsx` | `'use client'` | `RevivalKitPanel({ result, url })`, `KitStatus` |

`markdown.ts` imports only types and `timestampToIso` / `safeSnapshotUrl`-equivalent logic through relative `.ts` imports, so it can run under Node native TypeScript (e2e, docs example).

```ts
type RevivalKitInput = {
  result: ResurrectResponse; // already verified
  resource: string;          // normalized resource URL (receipts[0].url)
  proofSha256: string;       // 64 lowercase hex
};

type RevivalKitResult =
  | { ok: true; markdown: string; issueBody: string; proofSha256: string }
  | { ok: false; reason: 'unverified' | 'no-plan' };
```

`prepareRevivalKit` never throws; any thrown error inside becomes `{ ok: false, reason: 'unverified' }` (RK-02 AC-2).

## Escaping (RK-05)

`escapeMarkdown(value, max = 500)`:

1. `String(value ?? '')`.
2. Replace each run of control or layout characters with one space: C0 and C1 controls (includes CR, LF, TAB), U+2028, U+2029, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069. Trim.
3. Truncate to `max` code points, adding `…` when cut.
4. One pass, character by character: `&`→`&amp;`, `<`→`&lt;`, `>`→`&gt;`; each of `` \ ` * _ [ ] ( ) # ! | ~ @ $ `` gets a leading backslash. Everything else is kept.

Why this set: `[ ] ( ) !` stop links and images; `` ` `` stops code spans; `* _ ~` stop emphasis and strikethrough; `|` stops table cells from splitting; `#` stops headings and `#123` issue references; `@` stops GitHub mentions; `$` stops GitHub math; `\` keeps existing backslashes literal. `-`, `+`, `.`, `=` and `>` only matter at the start of a line, and user strings never start a line (template rule below), but `>` is entity-escaped anyway.

Template rules:

- Every user string is passed through `escapeMarkdown` exactly once.
- Every line that contains a user string starts with fixed text (`| `, `- `, `- [ ] `, `1. `, `**…**`).
- The generator's own text contains no `<` or `>`. Arrows in plan titles (`→`) are user data and are kept as-is (not ASCII).
- Hex values (proof SHA-256, receipt hash, commit SHA) go in code spans only after `/^[0-9a-f]+$/`; the public key only after `/^[A-Za-z0-9_-]+$/`. Otherwise they are escaped as text.
- Links: snapshot URL through the same rule as `safeSnapshotUrl` (https, `web.archive.org`, no credentials or port), then `(`, `)`, space percent-encoded; repository link is `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`. Link text is escaped.
- Dates are printed from the response: ISO strings as given (escaped), Wayback timestamps through `timestampToIso`. No `new Date()` for "now", no `toLocaleString`, so output is deterministic (RK-03 AC-6).

## REVIVAL.md layout (RK-03)

```
# Revival plan: <fullName>
Generated in the browser by Gravekeeper from a verified lookup of <resource> recorded at <receipts[0].fetchedAt>. …

## Repository facts            table: Repository (link), Description, Last push, Stars, Forks,
                               Open issues / PRs, License, Default branch, Archived on GitHub
## Archive snapshot            link + capture timestamp, or "None found"
## Recent commits              up to 5: - `sha7` date, author: message
## Revival plan                1. **Title.** Description   (every step, plan order)
## Dependency autopsy          only if result.autopsy: notes + table
## Epitaph timeline            only if result.timeline: facts + per-year table, or empty/unavailable sentence
## Revival tracking issue      intro line, then the exact issue body
## Proof reference             file name, SHA-256, receipts, last receipt hash, public key, commands, trust limit
```

The issue body is placed after a fixed line ("Paste everything between the two rules into a new GitHub issue."), between two `---` rules, so it stays byte-identical to the copied text (RK-04 AC-4). Its own headings are `###` so it nests under the REVIVAL.md section.

## Issue body (RK-04)

```
### Revival tracking issue

Tracking the revival of <fullName>. Plan generated by Gravekeeper from a verified lookup recorded at <fetchedAt>.

#### Tasks

- [ ] 1. <Title>: <Description>
…

#### Evidence

- Archive snapshot: <link> | None found
- Proof file: `gravekeeper-proof.json`, SHA-256 `<hex>`
- Integrity only: …
```

## UI (RK-01, RK-06)

`RevivalKitPanel` is rendered in `Gravekeeper.tsx` `Results` only when `result.spec && result.github`. It shows a heading "Take the plan home", one sentence about what the kit contains and its trust limit, the two buttons (`button` style, `min-h-11`), and `KitStatus` with two `role="status"` paragraphs (`#kit-download-status`, `#kit-copy-status`) that exist before any message.

Messages:

| Event | Region | Text |
|---|---|---|
| preparing | button label | "Preparing kit…" / "Preparing…" (button disabled) |
| download ok | download | "REVIVAL.md downloaded. Proof SHA-256 <first 12>…" |
| download refused | download | "Revival kit not created: the proof did not verify." |
| download error | download | "Download could not start. Please try again." |
| copy ok | copy | "Issue body copied." |
| copy refused | copy | "Issue body not copied: the proof did not verify." |
| clipboard error | copy | "Could not copy. The same text is in REVIVAL.md under Revival tracking issue." |

## Correctness properties (fast-check)

1. **Every step present**: for any spec with 1–12 steps of arbitrary strings, both REVIVAL.md and the issue body contain `escapeMarkdown(step.title)` and `escapeMarkdown(step.description)`, and the issue body has exactly one `- [ ] ` line per step, in order.
2. **No raw HTML**: for any arbitrary strings in description, commit messages, author names, dependency names, specs, notes, step titles and descriptions, the output contains no `<` and no `>`.
3. **No block injection**: `escapeMarkdown(s)` never contains a line break or other control character, and every special character in it is preceded by a backslash (round trip: unescaping gives back the normalized input).
4. **Issue embedded**: REVIVAL.md contains the issue body as an exact substring.
5. **Deterministic**: two calls with the same input produce identical strings.

## Out of scope

- Zip bundles, multiple files, or writing to GitHub (the user pastes the issue themselves).
- Signing the kit. The kit references the signed proof by hash; it is not a new receipt.
