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

### Task 9 — Shared types & Vitest config
- [ ] Create `vitest.config.mts` with `tsconfigPaths()` plugin and `environment: 'node'` (lib tests are server-only; no jsdom needed for phase 1–2 tests).
- [ ] Verify `npm run test` runs all existing tests green.
- **Refs:** all

---

### Task 10 — SearchForm component (`src/components/SearchForm.tsx`)
- [ ] `'use client'` Client Component.
- [ ] Controlled text input + submit button.
- [ ] Client-side URL validation (display inline error, no network call on invalid).
- [ ] Calls `POST /api/resurrect`, tracks loading state, surfaces API errors.
- [ ] Dispatches result to parent via `onResult` callback prop.
- [ ] Disabled state while loading (US-01 AC-5).
- [ ] `aria-live="polite"` region for error messages (US-07 AC-5).
- **Refs:** US-01, US-07

---

### Task 11 — TombstoneCard component (`src/components/TombstoneCard.tsx`)
- [ ] Server Component (accepts serialisable props, no client state).
- [ ] Displays: repo/URL name as epitaph, last push date, Wayback snapshot date, "R.I.P." motif.
- [ ] Gothic card styling via Tailwind utility classes.
- [ ] Proper heading hierarchy; all decorative SVGs `aria-hidden`.
- **Refs:** US-02, US-03, US-07

---

### Task 12 — ReceiptChainViewer component (`src/components/ReceiptChainViewer.tsx`)
- [ ] `'use client'` Client Component.
- [ ] Expandable/collapsible list of receipts showing `seq`, `kind`, `fetchedAt`, `hash` (truncated).
- [ ] "Export Receipt Chain" button — triggers JSON file download using `URL.createObjectURL`.
- [ ] Keyboard-operable accordion (Enter/Space to toggle).
- **Refs:** US-04 (AC-3), US-07 (AC-1)

---

### Task 13 — RevivalSpecPanel component (`src/components/RevivalSpecPanel.tsx`)
- [ ] `'use client'` Client Component.
- [ ] Accordion displaying detected stack, stale deps (with badges), and ordered revival steps.
- [ ] "Create Revived Fork" button — calls `POST /api/fork`; disabled with tooltip when no token (US-06 AC-3).
- [ ] `motion-reduce:` variants on all animated elements.
- **Refs:** US-05, US-06, US-07

---

### Task 14 — FogOverlay and ambient effects (`src/components/FogOverlay.tsx`)
- [ ] `'use client'` Client Component.
- [ ] CSS keyframe animation for drifting fog using Tailwind `@keyframes` in globals.css.
- [ ] Hidden via `motion-reduce:hidden` (US-07 AC-3).
- [ ] `aria-hidden="true"` (US-07 AC-2).
- **Refs:** US-07

---

### Task 15 — Home page assembly (`src/app/page.tsx`)
- [ ] Server Component page.
- [ ] Import and compose: `FogOverlay`, `SearchForm`, `TombstoneCard`, `ReceiptChainViewer`, `RevivalSpecPanel`.
- [ ] Manage result state via a `'use client'` wrapper if needed (or use URL search params for SSR-friendly state).
- [ ] Haunted graveyard layout: dark background, tombstone grid, candlelight amber accents.
- [ ] `<title>` and Open Graph metadata via Next.js `export const metadata`.
- **Refs:** US-01, US-07

---

## Phase 4 — Polish & Verification

### Task 16 — Accessibility audit
- [ ] Install `@axe-core/react` as a dev dependency and run in dev mode.
- [ ] Fix any WCAG 2.1 AA violations reported.
- [ ] Manually verify keyboard navigation end-to-end (Tab, Enter, Space, Escape on modals/accordions).
- **Refs:** US-07

---

### Task 17 — Final integration test
- [ ] Write `src/__tests__/resurrect-integration.test.ts` — mock external APIs, call the route handler logic end-to-end, verify `ResurrectResponse` shape and chain validity.
- [ ] Run `npm run build` and confirm zero TypeScript errors.
- **Refs:** all
