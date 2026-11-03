# Gravekeeper — Project Structure

## Directory Layout

```
gravekeeper/
├── src/
│   ├── app/                         # Next.js App Router root
│   │   ├── layout.tsx               # Root layout — fonts, global styles, theme
│   │   ├── page.tsx                 # Home page — search form + results
│   │   ├── globals.css              # Tailwind v4 @theme blocks, CSS custom properties
│   │   ├── error.tsx                # Root error boundary (Client Component)
│   │   ├── loading.tsx              # Root loading UI (Suspense fallback)
│   │   └── api/
│   │       ├── resurrect/
│   │       │   └── route.ts        # POST /api/resurrect — main orchestration endpoint
│   │       └── fork/
│   │           └── route.ts        # POST /api/fork — GitHub fork creation
│   │
│   ├── lib/                         # Pure server-side business logic (no React)
│   │   ├── wayback/
│   │   │   ├── client.ts           # fetchWaybackSnapshot(url) → WaybackResult
│   │   │   └── client.test.ts      # Unit tests (mocked fetch)
│   │   ├── github/
│   │   │   ├── client.ts           # fetchRepoMeta(owner, repo) → GitHubResult
│   │   │   │                       # fetchCommits(owner, repo) → Commit[]
│   │   │   └── client.test.ts
│   │   ├── receipts/
│   │   │   ├── chain.ts            # buildReceipt(), verifyChain(), canonicalJson()
│   │   │   ├── crypto.ts           # generateKeyPair(), sign(), verify() (Web Crypto)
│   │   │   ├── chain.test.ts       # Property-based tests with fast-check
│   │   │   └── crypto.test.ts
│   │   └── spec/
│   │       ├── generator.ts        # generateRevivalSpec(githubResult) → RevivalSpec
│   │       └── generator.test.ts
│   │
│   ├── components/                  # Shared UI components
│   │   ├── TombstoneCard.tsx        # Server Component — displays a receipt result
│   │   ├── FogOverlay.tsx           # Client Component — CSS fog animation
│   │   ├── SearchForm.tsx           # Client Component — controlled input + submit
│   │   ├── ReceiptChainViewer.tsx   # Client Component — expandable receipt list
│   │   └── RevivalSpecPanel.tsx     # Client Component — modernisation spec display
│   │
│   └── types/
│       └── index.ts                 # Shared TypeScript types (Receipt, RevivalSpec, etc.)
│
├── public/                          # Static assets
├── .kiro/
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md             # This file
│   └── specs/
│       └── resurrect/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── next.config.ts
├── tsconfig.json
├── vitest.config.mts                # Vitest configuration (to be created)
├── eslint.config.mjs
└── package.json
```

## Module Conventions

### `src/lib/` — business logic

- All modules under `src/lib/` are **server-only**. Add `import 'server-only'` at the top of each `lib` file once the package is installed.
- No React imports. No `'use client'` directive. Pure TypeScript functions.
- Each sub-module exports a clear public surface: named exports only, no default exports.
- Tests colocate as `<module>.test.ts` alongside the source file.

### `src/app/api/` — Route Handlers

- One file per endpoint: `src/app/api/<name>/route.ts`.
- Export only the HTTP methods that the route supports (`GET`, `POST`, etc.).
- Use `import type { NextRequest } from 'next/server'` and `RouteContext<'...'>` for typed params.
- Do not call `fetch` or perform IO directly in the handler body — delegate to `src/lib/` functions.
- Return `Response.json(data)` for success, `Response.json({ error }, { status: N })` for errors.
- Dynamic routes that read `headers()` / `cookies()` / request body are inherently dynamic and will not be prerendered — that is expected for this app.

### `src/app/` — Pages and Layouts

- Pages are **Server Components** by default. Fetch data in the page, pass serialisable props to Client Components.
- Interactive islands (form, animations, expandable panels) live in `src/components/` and are explicitly marked `'use client'`.
- The root `layout.tsx` wraps the app with any context providers needed (theme, reduced-motion detection).

### `src/types/index.ts`

Single source of truth for shared data types. Imported by both `lib/` and `components/`. No runtime code — types only.

## File Naming

| Kind | Convention | Example |
|---|---|---|
| React components | PascalCase `.tsx` | `TombstoneCard.tsx` |
| Route handlers | `route.ts` | `app/api/resurrect/route.ts` |
| Lib modules | camelCase `.ts` | `chain.ts` |
| Tests | `<source>.test.ts(x)` | `chain.test.ts` |
| Types | `index.ts` in `types/` | `types/index.ts` |
