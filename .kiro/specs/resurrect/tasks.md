# Resurrect Feature — Implementation Tasks

Tasks are ordered so each builds on the previous. Complete them in order. Each task references the requirement(s) it satisfies.

---

## Phase 1 — Core Library

### Task 1 — Shared types
- [x] Create `src/types/index.ts` with all interfaces from design.md: `Receipt`, `ReceiptKind`, `WaybackResult`, `GitHubRepoMeta`, `Commit`, `RevivalSpec`, `StaleDep`, `RevivalStep`, `ResurrectResponse`, `Result<T>`, `ErrorCode`.
- [x] Ensure no runtime code — types only.
- **Refs:** US-04, US-02, US-03, US-05

---

### Task 2 — Receipt crypto (`src/lib/receipts/crypto.ts`)
- [x] Implement `generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }>` using `crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify'])`.
- [x] Implement `exportPublicKey(publicKey: CryptoKey): Promise<string>` — base64url, no padding.
- [x] Implement `sign(data: Uint8Array, privateKey: CryptoKey): Promise<string>` — returns base64url signature.
- [x] Implement `verify(data: Uint8Array, signature: string, publicKey: CryptoKey): Promise<boolean>`.
- [x] Write `src/lib/receipts/crypto.test.ts` with fast-check property-based tests:
  - Sign→verify round-trip holds for arbitrary byte arrays.
  - Tampered data fails verification.
- **Refs:** US-04 (AC-1, AC-2, AC-6)

---

### Task 3 — Receipt chain (`src/lib/receipts/chain.ts`)
- [x] Implement `canonicalJson(obj: Record<string, unknown>): Uint8Array` — sorted keys, no extra whitespace, UTF-8.
- [x] Implement `sha256hex(data: Uint8Array): Promise<string>` using `crypto.subtle.digest`.
- [x] Implement `buildReceipt(prev: Receipt | null, kind: ReceiptKind, url: string, responseBody: Uint8Array, privateKey: CryptoKey): Promise<Receipt>` following the canonical JSON hashing spec in design.md.
- [x] Implement `verifyChain(receipts: Receipt[], publicKey: CryptoKey): Promise<{ valid: boolean; brokenAt?: number }>` — checks prevHash linkage, hash consistency, and signature on each receipt.
- [x] Write `src/lib/receipts/chain.test.ts` with fast-check property-based tests covering all six correctness properties from design.md.
- **Refs:** US-04 (AC-2, AC-4, AC-5, AC-6)

---

### Task 4 — Wayback Machine client (`src/lib/wayback/client.ts`)
- [x] Implement `fetchWaybackSnapshot(url: string): Promise<Result<WaybackResult>>`.
  - Call `https://archive.org/wayback/available?url=<url>` with `AbortSignal.timeout(10_000)`.
  - Parse the `archived_snapshots.closest` field.
  - Return `{ ok: false, code: 'WAYBACK_NO_SNAPSHOT' }` when `available` is false.
  - Return `{ ok: false, code: 'NETWORK_TIMEOUT' }` on timeout.
  - Return `{ ok: false, code: 'HTTP_ERROR' }` on non-2xx.
- [x] Write `src/lib/wayback/client.test.ts` — unit tests with mocked `fetch` covering: snapshot found, no snapshot, timeout, HTTP error.
- **Refs:** US-02 (AC-1, AC-3, AC-4)

---

### Task 5 — GitHub client (`src/lib/github/client.ts`)
- [x] Implement `fetchRepoMeta(owner: string, repo: string): Promise<Result<GitHubRepoMeta>>`.
  - Call `https://api.github.com/repos/<owner>/<repo>`.
  - Set `Authorization: Bearer <GITHUB_TOKEN>` header when env var is present.
  - Map 404 → `GITHUB_NOT_FOUND`, 403 → `GITHUB_RATE_LIMIT`.
- [x] Implement `fetchCommits(owner: string, repo: string, perPage?: number): Promise<Result<Commit[]>>`.
  - Call `/repos/<owner>/<repo>/commits?per_page=20`.
  - Extract `sha`, first line of `commit.message`, `commit.author.date`, `commit.author.name`.
- [x] Implement `parseGitHubUrl(url: string): { owner: string; repo: string } | null` — validates and parses `https://github.com/<owner>/<repo>` pattern.
- [x] Write `src/lib/github/client.test.ts` — unit tests with mocked `fetch`.
- **Refs:** US-03 (AC-1–6), US-01 (AC-2)

---

### Task 6 — Revival Spec generator (`src/lib/spec/generator.ts`)
- [x] Implement `generateRevivalSpec(meta: GitHubRepoMeta, commits: Commit[]): RevivalSpec`.
  - Detect language from GitHub `language` field.
  - Flag `archivedByGitHub: true` repos.
  - Generate at least three default revival steps (update README, check dependencies, add revival notice).
  - Set `generatedAt` to current UTC ISO timestamp.
- [x] Write `src/lib/spec/generator.test.ts` — unit tests for various repo shapes (archived, no language, recent commits).
- **Refs:** US-05 (AC-1–4)

---

## Phase 2 — API Routes

### Task 7 — Resurrect route handler (`src/app/api/resurrect/route.ts`)
- [x] Implement `POST /api/resurrect`:
  - Parse and validate `{ url: string }` from request JSON body. Return 400 on invalid input.
  - Determine if URL is a GitHub repo URL using `parseGitHubUrl`.
  - Generate an Ed25519 key pair.
  - Run Wayback fetch; build Receipt; handle errors gracefully (partial response, not crash).
  - If GitHub URL: run `fetchRepoMeta` and `fetchCommits`; build two Receipts.
  - If GitHub data available: run `generateRevivalSpec`; build `kind: "spec"` Receipt.
  - Return `ResurrectResponse` JSON with `publicKey`, `receipts`, `spec`, `wayback`, `github`.
- **Refs:** US-01, US-02, US-03, US-04, US-05

---

### Task 8 — Fork route handler (`src/app/api/fork/route.ts`)
- [x] Implement `POST /api/fork`:
  - Validate `{ owner: string, repo: string }` request body.
  - Return 503 `{ error: '...', code: 'FORK_FAILED' }` if `GITHUB_TOKEN` is not set.
  - Call `POST https://api.github.com/repos/<owner>/<repo>/forks`.
  - Return `{ forkUrl: string }` on success.
  - Build and return a Receipt of `kind: "fork"` in the response.
- **Refs:** US-06 (AC-1, AC-2, AC-4)

---

## Phase 3 — UI

Implementation note (Nov 6, 2026 UTC): the UI is consolidated in `src/components/Gravekeeper.tsx`; the page remains a Server Component. Browser proof helpers are in `src/client/proof.ts`. Public forking intentionally uses GitHub's own confirmation page rather than the operator API. See `docs/RELEASE_CHECKLIST.md` for remaining release gates.


### Task 9 — Shared types & Vitest config
- [x] Existing `vitest.config.mts` resolves the `@/` alias and uses `environment: 'node'`; no additional paths plugin is needed.
- [x] Verify `npm run test` runs all existing tests green.
- **Refs:** all

---

### Task 10 — SearchForm component (`src/components/SearchForm.tsx`)
- [x] `'use client'` Client Component (`SearchForm.tsx`).
- [x] Controlled text input + submit button.
- [x] Client-side URL validation (display inline error, no network call on invalid).
- [x] Calls `POST /api/resurrect`, tracks loading state, surfaces API errors.
- [x] Result state is owned by the `Gravekeeper.tsx` client wrapper; `SearchForm` reports through `onResult` / `onLoadingChange` callbacks.
- [x] Escape cancels a running lookup (window `keydown` while loading).
- [x] Disabled state while loading (US-01 AC-5).
- [x] Polite `role="status"` region for errors and lookup progress (US-07 AC-5).
- **Refs:** US-01, US-07

---

### Task 11 — TombstoneCard component (`src/components/TombstoneCard.tsx`)
- [x] No client state or `'use client'` directive; accepts serialisable props. Note: it is currently imported by the client `Gravekeeper.tsx`, so it renders on the client in practice (it would be a Server Component if composed from a server page).
- [x] Displays: repo/URL name as epitaph, last push date, Wayback snapshot date, Open issues / PRs count, "R.I.P." motif.
- [x] Gothic card styling via Tailwind utility classes.
- [x] Proper heading hierarchy; all decorative SVGs `aria-hidden`.
- **Refs:** US-02, US-03, US-07

---

### Task 12 — ReceiptChainViewer component (`src/components/ReceiptChainViewer.tsx`)
- [x] `'use client'` Client Component.
- [x] Expandable/collapsible native details show sequence, kind, fetchedAt, hash and payload digest.
- [x] "Export Receipt Chain" button — triggers JSON file download using `URL.createObjectURL`.
- [x] Keyboard-operable accordion (Enter/Space to toggle).
- **Refs:** US-04 (AC-3), US-07 (AC-1)

---

### Task 13 — RevivalSpecPanel component (`src/components/RevivalSpecPanel.tsx`)
- [x] `'use client'` Client Component.
- [x] Native `<details>` accordion (Enter/Space) displaying detected stack, maintenance flags (with badges), and ordered revival steps.
- [x] Public fork link opens GitHub for explicit confirmation using the visitor account. Operator POST requires a separate secret and is disabled by default.
- [x] `motion-reduce:` variants on the chevron transition; panel fade uses `motion-safe:`; global reduced-motion reset in `globals.css`.
- **Refs:** US-05, US-06, US-07

---

### Task 14 — FogOverlay and ambient effects (`src/components/FogOverlay.tsx`)
- [x] `'use client'` Client Component.
- [x] CSS keyframe animation for drifting fog using Tailwind `@keyframes` in globals.css.
- [x] Hidden via `motion-reduce:hidden` (US-07 AC-3).
- [x] `aria-hidden="true"` (US-07 AC-2).
- [x] Verified on main (Nov 11): component, `fog-drift-*` keyframes, `FogOverlay.test.tsx`, and the home-page composition test all present and passing; not reimplemented.
- **Refs:** US-07

---

### Task 15 — Home page assembly (`src/app/page.tsx`)
- [x] Server Component page.
- [x] `src/app/page.tsx` is a Server Component that composes `FogOverlay` and the `Gravekeeper` client wrapper. `SearchForm`, `TombstoneCard`, `ReceiptChainViewer`, and `RevivalSpecPanel` live in their own files.
- [x] Extract `SearchForm`, `TombstoneCard`, `ReceiptChainViewer`, and `RevivalSpecPanel` into their own files (shared `Mark.tsx`, `styles.ts`).
- [x] Result state is managed by the `'use client'` wrapper `Gravekeeper.tsx`.
- [x] Haunted graveyard layout: dark background, tombstone grid, candlelight amber accents.
- [x] `<title>` and Open Graph metadata via Next.js `export const metadata` in `src/app/layout.tsx`.
- **Refs:** US-01, US-07

---

## Phase 4 — Polish & Verification

### Task 16 — Accessibility audit
- [x] Deviation: used `@axe-core/playwright` (pinned 4.14.0, with `playwright` 1.65.0) against the production build instead of `@axe-core/react` in dev mode. `npm run a11y` (`scripts/a11y-audit.mts`).
- [x] Scanned `/`, `/` after a real lookup, `/restoration`, `/lantern-hill`, and both fixture documents. No violations on the product pages; the intentionally inaccessible "before" fixture reports 4. Color-contrast on `/` is "needs review" in axe and was checked by pixel sampling. Details in `docs/A11Y_AUDIT.md`.
- [x] Keyboard path verified with Playwright key events (Tab, Enter, Space, Escape during a lookup). Accordions are native `<details>`; the app has no modals.
- [ ] Not done: screen-reader pass, non-Chromium browsers, error-state scan.
- **Refs:** US-07

---

### Task 17 — Final integration test
- [x] Integration-style route tests mock upstream APIs and verify response shape, receipt chain, evidence payloads, and browser/offline proof integrity.
- [x] Run `npm run build` and confirm zero TypeScript errors (rerun after final edits).
- [x] `.github/workflows/ci.yml` runs `npm ci`, tests, lint, `tsc --noEmit`, and build on push and pull request (no secrets).
- **Refs:** all
