---
inclusion: fileMatch
fileMatchPattern: ["**/*.test.ts", "**/*.test.tsx"]
---

# Testing conventions

Loaded when editing test files. Runner is Vitest 5 (`vitest.config.mts`, `environment: 'node'`, `@/` alias to `src/`). Property tests use fast-check 4.

## Layout

- Tests sit next to the source as `<name>.test.ts` or `<name>.test.tsx`. Cross-module tests may go in `src/__tests__/`.
- `npm test` runs `vitest run` once. A single area: `npx vitest run src/lib/receipts src/client`.

## No real network

- Never make real HTTP requests in unit tests. Stub fetch with `vi.stubGlobal("fetch", vi.fn(...))` and restore it in `afterEach` (`vi.unstubAllGlobals()`), as in `src/lib/github/client.test.ts`, `src/lib/wayback/client.test.ts` and the route tests under `src/app/api/`.
- Assert the request too (URL, headers, `per_page`), not only the parsed result.
- Cover each typed failure: timeout (`NETWORK_TIMEOUT`), non-2xx (`HTTP_ERROR`), `GITHUB_NOT_FOUND`, `GITHUB_RATE_LIMIT`, malformed JSON (`PARSE_ERROR`). Lib functions return `Result<T>`; tests check `ok` and `code`, not thrown errors.
- Browser end-to-end checks live in `scripts/e2e-smoke.mts` and mock `/api/resurrect` in the browser with `page.route`. They are not Vitest tests and need a running build.

## Property-based tests

- Receipt-chain properties from `.kiro/specs/resurrect/design.md` (determinism, chain integrity, hash consistency, signature round-trip, tamper detection, seq monotonicity) stay covered in `src/lib/receipts/chain.test.ts` and `crypto.test.ts`.
- Generate keys once in `beforeAll`; Ed25519 key generation per run is slow. Set `numRuns` explicitly for async crypto properties (existing suites use 10–200).
- Build URL and date arbitraries from simple generators (`fc.stringMatching`, `fc.integer` timestamps mapped to ISO strings). `fc.date()` can yield `Invalid Date` in fast-check 4.
- Tamper properties must change at least one byte or field; guard against no-op mutations.

## Components

- Async Server Components cannot be rendered by Vitest. Extract the logic into pure functions and test those.
- Client components are checked with `renderToStaticMarkup` from `react-dom/server` (see `ReceiptChainViewer.test.tsx`). There is no DOM test environment; do not add jsdom or Testing Library without asking.

## Honesty

- Do not mark a check as passing in docs or `tasks.md` unless it was run. Quote the real test count from the latest `npm test` output.
