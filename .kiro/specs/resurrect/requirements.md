# Resurrect Feature — Requirements

## Overview

Users submit an abandoned GitHub repository URL or a dead web URL. The system fetches its last known state, produces a tamper-evident receipt chain, generates a Revival Spec, and optionally creates a revived GitHub fork.

---

## User Stories & Acceptance Criteria (EARS notation)

### US-01 — Submit a resource for resurrection

**As a** developer or archivist,
**I want to** enter a GitHub repo URL or any dead URL into a search form,
**so that** the system initiates a resurrection lookup.

**Acceptance criteria:**

1. **[Ubiquitous]** The home page SHALL display a text input and a "Resurrect" submit button.
2. **[Event-driven]** WHEN the user submits a valid GitHub repo URL (`https://github.com/<owner>/<repo>`), THEN the system SHALL route the request to the resurrection pipeline.
3. **[Event-driven]** WHEN the user submits any other URL (non-GitHub), THEN the system SHALL route the request to the Wayback Machine lookup pipeline only.
4. **[Unwanted]** IF the submitted value is not a valid URL, THEN the system SHALL display an inline validation error before making any network request.
5. **[State-driven]** WHILE a resurrection is in progress, the submit button SHALL be disabled and a loading state SHALL be shown.

---

### US-02 — Wayback Machine snapshot retrieval

**As a** user,
**I want to** see the most recent Wayback Machine snapshot for the submitted URL,
**so that** I know the last date and time the resource was archived.

**Acceptance criteria:**

1. **[Event-driven]** WHEN the resurrection pipeline runs for any URL, THEN the system SHALL call the Wayback Machine Availability API and return the latest snapshot URL and timestamp.
2. **[Event-driven]** WHEN the Wayback Machine returns a snapshot, THEN the result SHALL be recorded as a Receipt of `kind: "wayback"` in the receipt chain.
3. **[Unwanted]** IF the Wayback Machine returns no snapshot for the URL, THEN the system SHALL surface a "No archived snapshot found" message and still record a Receipt of `kind: "wayback-miss"`.
4. **[Unwanted]** IF the Wayback Machine API call times out (> 10 seconds) or returns a non-2xx status, THEN the system SHALL surface a typed error message and not record a malformed Receipt.

---

### US-03 — GitHub repository metadata and commit history retrieval

**As a** developer,
**I want to** see repository metadata (stars, last push date, license, open issues) and recent commit history for a submitted GitHub URL,
**so that** I can understand how abandoned the repo is.

**Acceptance criteria:**

1. **[Event-driven]** WHEN a GitHub repo URL is submitted, THEN the system SHALL fetch repository metadata from the GitHub REST API v3.
2. **[Event-driven]** WHEN a GitHub repo URL is submitted, THEN the system SHALL fetch the last 20 commits for the default branch.
3. **[Event-driven]** WHEN metadata and commits are successfully fetched, THEN each fetch SHALL be recorded as a Receipt (`kind: "github-meta"` and `kind: "github-commits"` respectively).
4. **[Unwanted]** IF the GitHub API returns 404, THEN the system SHALL surface a "Repository not found" error.
5. **[Unwanted]** IF the GitHub API returns 403 (rate limit), THEN the system SHALL surface a "GitHub rate limit exceeded — add a GITHUB_TOKEN" error.
6. **[Optional]** WHERE a `GITHUB_TOKEN` environment variable is set, the system SHALL use it as a Bearer token to raise the rate limit to 5,000 requests/hour.

---

### US-04 — Tamper-evident receipt chain

**As a** researcher or auditor,
**I want** every external fetch to be recorded in a hash-chained, Ed25519-signed receipt,
**so that** I can verify the audit trail offline without trusting the server.

**Acceptance criteria:**

1. **[Ubiquitous]** The system SHALL create an Ed25519 key pair at the start of each resurrection session.
2. **[Ubiquitous]** Each Receipt SHALL contain `seq` (monotonically increasing integer starting at 0), `prevHash` (SHA-256 hex of the previous Receipt's canonical JSON, or `null` for seq 0), `hash` (SHA-256 hex of the current Receipt's canonical JSON excluding `hash` and `signature`), `kind`, `url`, `fetchedAt` (ISO 8601 UTC), `contentSha256` (SHA-256 hex of the raw response body), and `signature` (base64url Ed25519 signature over the canonical JSON).
3. **[Event-driven]** WHEN the user requests chain export, THEN the system SHALL produce a JSON file containing the ordered receipt array and the session public key (base64url).
4. **[Ubiquitous]** The canonical JSON for hashing SHALL use sorted keys, no unnecessary whitespace, and UTF-8 encoding.
5. **[Unwanted]** IF any Receipt's `prevHash` does not match the SHA-256 of the preceding Receipt, THEN chain verification SHALL fail and report the broken link position.
6. **[Unwanted]** IF any Receipt's `signature` does not verify against the session public key, THEN chain verification SHALL fail and report which receipt is invalid.

---

### US-05 — Revival Spec generation

**As a** developer,
**I want** the system to analyse the retrieved repo data and generate a structured Revival Spec,
**so that** I have concrete, ordered steps to modernise the project.

**Acceptance criteria:**

1. **[Event-driven]** WHEN GitHub metadata and commits are available, THEN the system SHALL generate a Revival Spec containing: detected language(s), detected primary framework (if identifiable), a list of dependencies flagged as outdated or abandoned (with suggested replacements), and an ordered list of revival steps.
2. **[Ubiquitous]** Revival steps SHALL include at minimum: update the README, replace archived/deprecated dependencies, update CI configuration if detected.
3. **[State-driven]** WHILE no GitHub data is available (Wayback-only lookup), the Revival Spec SHALL contain only the snapshot information and a note that full spec requires a GitHub URL.
4. **[Event-driven]** WHEN the Revival Spec is generated, THEN the generation event SHALL be recorded as a Receipt of `kind: "spec"` with `contentSha256` over the serialised spec JSON.

---

### US-06 — Fork creation

**As a** developer,
**I want to** optionally create a revived GitHub fork of the analysed repository,
**so that** I can continue the project under my own account.

**Acceptance criteria:**

1. **[Optional]** WHERE the user clicks "Create Revived Fork" and `GITHUB_TOKEN` is configured, the system SHALL call the GitHub fork API and return the new fork URL.
2. **[Event-driven]** WHEN a fork is successfully created, THEN the fork event SHALL be recorded as a Receipt of `kind: "fork"`.
3. **[Unwanted]** IF `GITHUB_TOKEN` is not set, THEN the "Create Revived Fork" button SHALL be disabled with a tooltip explaining the requirement.
4. **[Unwanted]** IF the fork API call fails, THEN the system SHALL surface the GitHub error message without crashing the page.

---

### US-07 — Accessibility

**As a** user with a disability or motion sensitivity,
**I want** the application to be fully keyboard-navigable and to respect my motion preferences,
**so that** the haunted UI effects do not impair my use of the tool.

**Acceptance criteria:**

1. **[Ubiquitous]** All interactive elements SHALL be reachable and operable via keyboard alone.
2. **[Ubiquitous]** All images and decorative icons SHALL have appropriate `alt` text or `aria-hidden="true"`.
3. **[Ubiquitous]** All animated elements (fog, candle flicker, tombstone entrance) SHALL use `@media (prefers-reduced-motion: reduce)` or Tailwind's `motion-reduce:` variant to disable or substantially reduce motion.
4. **[Ubiquitous]** All text SHALL meet WCAG 2.1 AA contrast ratio requirements (4.5:1 for normal text, 3:1 for large text).
5. **[Ubiquitous]** Error messages and status updates SHALL be announced to screen readers via `aria-live` regions.
