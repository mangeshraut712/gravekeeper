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
- [x] Create `vitest.config.mts` with `environment: 'node'` and the `@/` alias (the `@/` alias is mapped in the config directly; a separate `tsconfigPaths()` plugin was not required).
- [x] Verify `npm run test` runs all existing tests green.
- **Refs:** all

---

### Task 10 — Search form (`src/components/ResurrectApp.tsx`)
- [x] `'use client'` form with a controlled URL input and submit button. Shipped inside `ResurrectApp` rather than a separate `SearchForm.tsx`.
- [x] Client-side URL validation (inline error, no request on an invalid URL).
- [x] Calls `POST /api/resurrect`, tracks loading state, surfaces API errors.
- [x] Disabled submit while loading (US-01 AC-5).
- [x] `role="alert"` for errors and `role="status"` for progress (US-07 AC-5).
- **Refs:** US-01, US-07

---

### Task 11 — Result summary (inside `ResurrectApp`)
- [x] Shows the fixture title and disclosure, or GitHub full name, stars, license, last push, and Wayback time.
- [x] Tailwind layout on the dark product surface. Decorative flame and fog are `aria-hidden`.
- **Refs:** US-02, US-03, US-07

---

### Task 12 — Receipt chain (inside `ResurrectApp`)
- [x] Expandable receipt rows (`details`/`summary`, keyboard operable) showing `seq`, `kind`, `fetchedAt`, truncated hash, full hash, and content hash.
- [x] Export button downloads `gravekeeper-receipts.json` via `URL.createObjectURL`.
- [x] Verify-in-browser and verify-a-file both call `verifyReceiptExport`.
- **Refs:** US-04 (AC-3), US-07 (AC-1)

---

### Task 13 — Revival checklist and fork (inside `ResurrectApp`)
- [x] Ordered revival steps for a GitHub result.
- [x] "Create revived fork" calls `POST /api/fork`. The button is disabled, with visible text and a `title`, when `GET /api/fork` reports no token (US-06 AC-3).
- [x] `motion-reduce:` hides the fog animation.
- **Refs:** US-05, US-06, US-07

---

### Task 14 — FogOverlay and ambient effects (`src/components/FogOverlay.tsx`)
- [x] Fog layer with a keyframe in `globals.css`.
- [x] Hidden via `motion-reduce:hidden` (US-07 AC-3). The candle animation is also cancelled under `prefers-reduced-motion`.
- [x] `aria-hidden="true"` (US-07 AC-2).
- **Refs:** US-07

---

### Task 15 — Home page assembly (`src/app/page.tsx`)
- [x] Server page renders the client `ResurrectApp` (search, before/after, receipts, revival checklist, fog).
- [x] Dark soil background, bone type, amber accent. Product copy, not the create-next-app starter.
- [x] `<title>` and Open Graph metadata in `layout.tsx`.
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
- [x] Route tests in `src/app/api/resurrect/route.test.ts` mock external APIs, check the response shape, and `verifyChain` the GitHub path. The fixture path asserts no `fetch` and a verifiable chain. A separate `__tests__` file was not added.
- [x] `npm run build` completes with zero TypeScript errors.
- **Refs:** all

---

## Phase 5 — Concrete restoration (hand-updated; not a Kiro session)

### Task 18 — Lantern Hill restoration
- [x] Original MIT-licensed fixture and `restoreDeadHtml()`.
- [x] `POST /api/resurrect` returns before HTML, after HTML, and `fixture` / `restoration` receipts for the fixture URL. Live lookups unchanged.
- [x] `/fixtures/lantern-hill/before` and `/after` serve the two documents.
- **Refs:** US-01, US-02, US-05

### Task 19 — Export and offline verify
- [x] `buildReceiptExport` / `verifyReceiptExport`, including artifact hash checks.
- [x] `POST /api/verify`.
- [x] Homepage export, local verify, tampered-copy verify, and file verify.
- **Refs:** US-04
