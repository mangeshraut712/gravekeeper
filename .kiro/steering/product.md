# Gravekeeper — Product

## Overview

Gravekeeper is a Kiroween 2026 Resurrection-category hackathon entry. It lets a user input an abandoned GitHub repository URL or a dead web URL and breathe life back into it: fetching its last known state from the Internet Archive Wayback Machine, analysing its GitHub metadata and commit history, and generating a concrete modernisation plan — all wrapped in a haunted-graveyard aesthetic.

## Problem

Countless open-source repositories and websites go dark — maintainers move on, domains expire, build tooling rots. There is no single tool that: (a) verifies a resource is still retrievable, (b) creates a tamper-evident audit trail of that verification, and (c) produces actionable revival steps with an option to fork and continue the work.

## Core Capabilities

### 1 — Resource Lookup
- Accept a GitHub repo URL (`https://github.com/owner/repo`) or any dead web URL.
- For GitHub repos: fetch repository metadata (stars, last push, license, open issues) and the last 20 commits via the GitHub REST API.
- For any URL: query the Wayback Machine Availability API to find the latest archived snapshot.

### 2 — Tamper-Evident Receipt Chain
- Every external fetch is recorded as a **Receipt**: a JSON document containing `seq`, `prevHash`, `hash`, `kind`, `url`, `fetchedAt`, `contentSha256`, and an **Ed25519 signature** over its canonical JSON encoding.
- Receipts are SHA-256 hash-chained so any tampering with any record breaks the chain — verifiable offline with no server required.
- Users can export the receipt chain as a JSON file for independent verification.

### 3 — Modernisation Spec
- Analyse the retrieved data to detect the original tech stack (language, framework, dependency versions).
- Identify outdated or abandoned dependencies by comparing against known current versions.
- Generate a structured Revival Spec: detected stack, what is stale, recommended replacements, and ordered revival steps.
- For the bundled Lantern Hill fixture, also emit a concrete restored HTML document (semantic HTML5) rather than only a checklist. The fixture is original demo content under the repository MIT license. Live GitHub repositories still receive the checklist, not a rewritten tree.

### 4 — Fork Creation
- Optionally create a revived GitHub fork of the repository using the authenticated GitHub API.
- Apply a starter modernisation commit (update README, add a revival notice).

## UI / Experience

- **Haunted graveyard aesthetic**: tombstone cards for dead repos/URLs, flickering candlelight CSS effects, fog overlay, gothic typography, dark palette with amber/bone accents.
- **Fully accessible**: WCAG 2.1 AA minimum — reduced-motion alternatives for all animations, correct heading hierarchy, keyboard navigation, sufficient contrast on all text.
- Single-page flow: search → loading (rising-from-grave animation) → results (tombstone card with receipt chain + Revival Spec) → optional fork action.

## Non-Goals

- No user accounts or persistent server-side storage (receipts live in the client session and are exportable).
- No bulk/batch processing in v1.
- Automatic rewriting is limited to the bundled Lantern Hill HTML fixture. Live repositories receive a revival checklist and receipts.

## Success Criteria

- A user can enter a GitHub URL and receive a full receipt-chained result + Revival Spec within 10 seconds on a normal network connection.
- The receipt chain passes offline verification (hash chain integrity + Ed25519 signature) 100% of the time.
- Zero WCAG 2.1 AA violations as reported by axe-core.
