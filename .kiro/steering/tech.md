# Gravekeeper — Tech Stack

## Runtime & Framework

- **Next.js 16.4.4** (App Router, `src/app` layout)
  - `cacheComponents: true` — Route Handlers follow the same caching model as UI routes; use `'use cache'` in extracted helper functions, never directly in Route Handler bodies.
  - `partialPrefetching: true` — prefetch partial page content.
  - `reactCompiler: true` — React Compiler is active; do not add manual `useMemo`/`useCallback` optimisations that fight the compiler.
  - Turbopack dev server with `@tailwindcss/turbopack` loader.
- **React 19.3.0** — Server Components by default; add `'use client'` only at the boundary where browser APIs, state, or event handlers are needed.

## Language & Types

- **TypeScript 5** with `strict: true`, `moduleResolution: bundler`, `paths: { "@/*": ["./src/*"] }`.
- Import project code using the `@/` alias, never relative `../../` paths across module boundaries.
- Prefer `type` over `interface` for data shapes; `interface` for extension points.

## Styling

- **Tailwind CSS v4** via the `@tailwindcss/turbopack` Turbopack plugin. No separate `tailwind.config.*` file is used by default in v4 — configuration lives in CSS `@theme` blocks inside `src/app/globals.css`.
- Use Tailwind utility classes for all styling. Do not introduce CSS Modules or additional CSS-in-JS libraries.
- Respect `prefers-reduced-motion` by using Tailwind's `motion-safe:` / `motion-reduce:` variants on all animations.

## Cryptography

- **Ed25519 key generation and signing**: `globalThis.crypto.subtle` (Web Crypto API, available in Node.js 18+ and all modern browsers). No third-party crypto library required.
- **SHA-256 hashing**: `globalThis.crypto.subtle.digest('SHA-256', data)`.
- Keys are ephemeral per session. Private key lives only in memory; public key is embedded in every Receipt for offline verification.

## Data Fetching (lib modules)

- **Wayback Machine**: `fetch()` against `https://archive.org/wayback/available?url=<url>` (no auth required).
- **GitHub REST API v3**: `fetch()` with `Authorization: Bearer <token>` from `GITHUB_TOKEN` env var. Uses unauthenticated rate limit (60 req/hr) if token absent.
- All external `fetch` calls must: set an `AbortSignal` with a 10-second timeout, handle non-2xx as typed errors, never swallow errors silently.

## Testing

- **Vitest 5.1.0** — unit and integration tests. Config lives in `vitest.config.mts`.
- **fast-check 4.10.2** — property-based tests for the receipt chain (hash chaining, canonical JSON, signature round-trips).
- Test files colocate with source as `*.test.ts` / `*.test.tsx`, or live in `src/__tests__/` for cross-module integration tests.
- Async Server Components are not directly unit-testable with Vitest (React limitation); test their logic by extracting pure functions.

## Environment Variables

| Name | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` | Optional | GitHub personal access token for higher rate limits and fork creation |

Never prefix with `NEXT_PUBLIC_` — these must stay server-only.

## Linting

- ESLint 9 with `eslint-config-next` via `eslint.config.mjs` (flat config format).
- Run `npm run lint` before committing.

## Build & Dev

```bash
npm run dev      # Turbopack dev server
npm run build    # Production build
npm run test     # vitest run (single-pass CI mode)
```
