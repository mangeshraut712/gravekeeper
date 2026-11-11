# Revival Kit — Requirements

## Overview

A lookup ends with a revival plan, a dependency autopsy, an Epitaph timeline and a signed proof, but a maintainer still has to copy all of that by hand into their own repository. The revival kit turns a verified lookup into two things they can use right away:

- **REVIVAL.md**: one Markdown file with the repository facts, the archive snapshot link, the revival plan steps, the dependency autopsy table (if present), the Epitaph timeline (if present), a ready-to-paste "Revival tracking issue" body, and a reference to the proof file with its SHA-256.
- **Issue body**: the "Revival tracking issue" text alone, with one task checkbox per plan step, copied to the clipboard.

Everything is generated in the browser from data already in the lookup response. Nothing new is fetched and nothing is sent to a server.

Terms:

- **Proof file**: the exact bytes of the "Download proof" export (`exportProof(result, url)`, UTF-8), named `gravekeeper-proof.json`.
- **Proof SHA-256**: `sha256hex()` of the proof file bytes, lowercase hex.
- **User-controlled string**: any string that comes from upstream data or the user: repository name, description, license, language, branch, commit messages and author names, dependency names, specs, versions and notes, plan step titles and descriptions (they embed package names), error codes, and the resource URL.

A valid proof shows internal consistency under the key in the file. The kit inherits that limit: the SHA-256 ties the plan to the signed evidence, but does not show that GitHub, the registries or the Internet Archive were truthful.

---

### RK-01 — Offer the kit

1. **[Event-driven]** WHEN a lookup result has a revival plan and GitHub metadata, THEN the results SHALL show a "Revival kit" section with a "Download revival kit" button and a "Copy issue body" button.
2. **[State-driven]** WHILE a result has no revival plan (Wayback-only lookups or failed GitHub reads), the results SHALL NOT show the "Revival kit" section.
3. **[Ubiquitous]** Both buttons SHALL be native `<button>` elements, keyboard operable, at least 44 CSS px high, with text that names the action without an icon.

### RK-02 — Verify before export

1. **[Event-driven]** WHEN the user activates either button, THEN the system SHALL run the same browser proof verification as "Verify proof" (`verifyProof(result, url)`) before generating anything.
2. **[Unwanted]** IF verification fails or throws, THEN the system SHALL NOT start a download or write to the clipboard, and SHALL announce that the kit was not created because the proof did not verify.
3. **[Ubiquitous]** The kit SHALL be generated only from the verified response (`github`, `wayback`, `spec`, `autopsy`, `timeline`, `receipts`, `publicKey`) and the resource URL. It SHALL NOT make network requests.

### RK-03 — REVIVAL.md content

1. **[Event-driven]** WHEN verification passes and the user activates "Download revival kit", THEN the system SHALL download one UTF-8 Markdown file named `REVIVAL.md`.
2. **[Ubiquitous]** REVIVAL.md SHALL contain: repository facts (full name, description, last push, stars, forks, open issues / PRs, license, default branch, archived on GitHub), the archive snapshot link or "None found", up to the five most recent commits, every revival plan step in order with its title and description, the "Revival tracking issue" body, and the proof reference.
3. **[Optional]** WHERE the result has a dependency autopsy, REVIVAL.md SHALL include its state notes and a table of package, group, declared, latest, status and note.
4. **[Optional]** WHERE the result has an Epitaph timeline, REVIVAL.md SHALL include born, last seen, years on record, captured months and a table of captured months per year, or a sentence that the index was empty or could not be read.
5. **[Ubiquitous]** The proof reference SHALL include the proof file name, the proof SHA-256, the receipt count, the hash of the last receipt, the public key, the commands to check the hash and run the offline verifier, and the trust-limit sentence.
6. **[Ubiquitous]** For the same result and resource, the generated Markdown SHALL be identical every time (no clock or locale reads; dates are printed from the response in ISO form).

### RK-04 — Revival tracking issue

1. **[Ubiquitous]** The issue body SHALL be titled "Revival tracking issue" and SHALL contain one `- [ ]` task checkbox per revival plan step, in plan order, plus the archive snapshot link and the proof SHA-256.
2. **[Event-driven]** WHEN verification passes and the user activates "Copy issue body", THEN the system SHALL write exactly the issue body to the clipboard and announce "Issue body copied." in a polite status region.
3. **[Unwanted]** IF the clipboard write fails, THEN the system SHALL announce that copying failed and that the same text is in REVIVAL.md.
4. **[Ubiquitous]** The issue body inside REVIVAL.md SHALL be byte-identical to the copied issue body.

### RK-05 — Neutralize injection

1. **[Ubiquitous]** Every user-controlled string SHALL be escaped before it is placed in Markdown: `&`, `<` and `>` become `&amp;`, `&lt;` and `&gt;`, and the Markdown and GitHub punctuation `` \ ` * _ [ ] ( ) # ! | ~ @ $ `` is backslash-escaped, so no input can create HTML, links, images, emphasis, code, tables, mentions, issue references or math.
2. **[Ubiquitous]** Line breaks, other control characters, Unicode line and paragraph separators and bidirectional control characters in user-controlled strings SHALL be replaced with a space, so input cannot start a new Markdown block.
3. **[Ubiquitous]** User-controlled strings SHALL never be placed at the start of a line.
4. **[Ubiquitous]** The generator SHALL never emit `<` or `>` itself, so any `<` in the output would be a defect.
5. **[Ubiquitous]** Links SHALL be emitted only for the archive snapshot (after `safeSnapshotUrl`, `web.archive.org` only) and the repository page (`https://github.com/` plus percent-encoded owner and repo).

### RK-06 — Status and accessibility

1. **[Ubiquitous]** The download result and the copy result SHALL be announced in two separate `role="status"` regions that exist before any message, so one never hides the other.
2. **[State-driven]** WHILE the kit is being prepared, the activated button SHALL be disabled and say what is happening.
3. **[Ubiquitous]** UI text SHALL state that the kit is generated in the browser from the verified lookup and that the SHA-256 ties it to the downloaded proof, not to upstream truth.
