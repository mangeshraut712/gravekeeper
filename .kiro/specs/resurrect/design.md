# Resurrect Feature — Design

## Architecture

```
Browser (Client Components)
    │
    │  POST /api/resurrect  { url: string }
    ▼
Route Handler (src/app/api/resurrect/route.ts)
    │
    ├──▶ lib/wayback/client.ts      fetchWaybackSnapshot(url)
    ├──▶ lib/github/client.ts       fetchRepoMeta(owner, repo)
    │                               fetchCommits(owner, repo)
    ├──▶ lib/receipts/chain.ts      buildReceipt(prev, kind, url, body)
    │    lib/receipts/crypto.ts     sign(receipt, privateKey)
    └──▶ lib/spec/generator.ts      generateRevivalSpec(githubResult)
    │
    │  JSON response  { receipts: Receipt[], spec: RevivalSpec, publicKey: string }
    ▼
Browser — renders TombstoneCard + ReceiptChainViewer + RevivalSpecPanel
```

The Route Handler is stateless — it generates a fresh key pair per request, performs all IO, assembles the chain, and returns everything in one JSON response. No server-side persistence.

---

## Data Models

### Receipt

```typescript
type ReceiptKind =
  | 'wayback'
  | 'wayback-miss'
  | 'github-meta'
  | 'github-commits'
  | 'spec'
  | 'fork'
  | 'fixture'          // Lantern Hill fixture (see "Bundled restoration")
  | 'restoration'      // Lantern Hill restored HTML
  | 'github-manifest'  // root dependency manifest (see .kiro/specs/dependency-autopsy)
  | 'registry'         // batched npm/PyPI latest-version lookups (dependency autopsy)
  | 'wayback-cdx';     // Internet Archive CDX monthly capture index (see .kiro/specs/epitaph-timeline)

interface Receipt {
  seq: number;           // 0-based, monotonically increasing
  prevHash: string | null; // null for seq=0; SHA-256 hex of previous receipt's canonical JSON
  hash: string;          // SHA-256 hex of this receipt's canonical JSON (fields below, sorted)
  kind: ReceiptKind;
  url: string;           // The external URL that was fetched
  fetchedAt: string;     // ISO 8601 UTC, e.g. "2026-11-03T06:09:00.000Z"
  contentSha256: string; // SHA-256 hex of the raw response body bytes
  signature: string;     // base64url Ed25519 signature over canonical JSON
}
```

**Canonical JSON definition:** The canonical JSON of a Receipt for hashing purposes is produced by:
1. Taking the Receipt object **without** the `hash` and `signature` fields.
2. Sorting all top-level keys lexicographically.
3. Serialising with `JSON.stringify` (no extra whitespace).
4. Encoding as UTF-8 bytes.

The `hash` field is then `SHA-256(canonicalBytes)` encoded as lowercase hex.
The `signature` field is `Ed25519Sign(canonicalBytes, privateKey)` encoded as base64url (no padding).

### WaybackResult

```typescript
interface WaybackResult {
  available: boolean;
  url: string;           // original queried URL
  snapshotUrl: string | null;
  timestamp: string | null; // e.g. "20231015120000"
  status: string | null;    // HTTP status of the original archived page
}
```

### GitHubRepoMeta

```typescript
interface GitHubRepoMeta {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  defaultBranch: string;
  pushedAt: string;      // ISO 8601
  archivedByGitHub: boolean;
}
```

### Commit

```typescript
interface Commit {
  sha: string;
  message: string;       // first line only
  authorDate: string;    // ISO 8601
  authorName: string;
}
```

### RevivalSpec

```typescript
interface StaleDep {
  name: string;
  detectedVersion: string | null;
  reason: 'outdated' | 'archived' | 'renamed' | 'unknown';
  suggestion: string | null;
}

interface RevivalStep {
  order: number;
  title: string;
  description: string;
}

interface RevivalSpec {
  detectedLanguages: string[];
  detectedFramework: string | null;
  staleDeps: StaleDep[];
  revivalSteps: RevivalStep[];
  generatedAt: string;   // ISO 8601 UTC
}
```

### ResurrectResponse (API response)

```typescript
interface ResurrectResponse {
  receipts: Receipt[];
  evidence: { receiptSeq: number; body: unknown }[]; // exact normalized payload hashed by each receipt
  spec: RevivalSpec | null;   // null for Wayback-only lookups
  wayback: WaybackResult | null;
  github: {
    meta: GitHubRepoMeta;
    commits: Commit[];
  } | null;
  publicKey: string;          // base64url-encoded Ed25519 public key for offline verification
  restoration?: RestorationResult | null;
  autopsy?: DependencyAutopsy | null; // GitHub lookups only; defined in .kiro/specs/dependency-autopsy/design.md
  timeline?: EpitaphTimeline | null;  // any lookup; derived from the wayback-cdx receipt, defined in .kiro/specs/epitaph-timeline/design.md
}
```

---

## Canonical JSON Hashing — Correctness Properties

These properties MUST hold and are covered by property-based tests using fast-check:

1. **Determinism**: `canonicalJson(r)` returns the same bytes for equal Receipt objects regardless of original key insertion order.
2. **Chain integrity**: For any chain `[r0, r1, …, rN]`, `rK.prevHash === sha256hex(canonicalJson(r_{K-1}))` for all K ≥ 1.
3. **Hash consistency**: `rK.hash === sha256hex(canonicalJson(omit(rK, ['hash', 'signature'])))`.
4. **Signature round-trip**: A Receipt signed with `privateKey` verifies successfully against the corresponding `publicKey`.
5. **Tamper detection**: Mutating any field on any Receipt in a valid chain causes `verifyChain()` to return `false`.
6. **Seq monotonicity**: For any valid chain, `receipts[i].seq === i` for all i.

---

## Error Handling

All lib functions return discriminated unions rather than throwing:

```typescript
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode };

type ErrorCode =
  | 'NETWORK_TIMEOUT'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'GITHUB_NOT_FOUND'
  | 'GITHUB_RATE_LIMIT'
  | 'WAYBACK_NO_SNAPSHOT'
  | 'CRYPTO_ERROR'
  | 'FORK_FAILED'
  | 'MANIFEST_NOT_FOUND'; // no root manifest on the default branch (dependency autopsy)
```

The Route Handler inspects each `Result` and:
- On `ok: true`: builds the Receipt and appends to the chain.
- On `ok: false`: returns a partial response with `{ error, code }` so the UI can display a typed message without crashing.

Fetch calls use `AbortSignal.timeout(10_000)` to enforce the 10-second deadline (US-01.5, US-02.4).

---

## API Route Contracts

### POST /api/resurrect

Request body: `{ url: string }`

Success response (200):
```json
{
  "receipts": [...],
  "spec": { ... } | null,
  "wayback": { ... } | null,
  "github": { "meta": {...}, "commits": [...] } | null,
  "publicKey": "<base64url>"
}
```

Error response (400 / 500):
```json
{ "error": "<message>", "code": "<ErrorCode>" }
```

### POST /api/fork

Request body: `{ owner: string, repo: string }`

Requires `GITHUB_TOKEN` env var. Returns 503 if absent.

Success response (200):
```json
{ "forkUrl": "https://github.com/<authed-user>/<repo>" }
```

---

## Property-Based Test Design (fast-check)

### `chain.test.ts`

```typescript
// Property: any chain built by buildChain() passes verifyChain()
fc.property(
  fc.array(fc.record({ kind: fc.constantFrom(...kinds), url: fc.webUrl() }), { minLength: 1, maxLength: 10 }),
  async (inputs) => {
    const chain = await buildChain(inputs, keyPair);
    expect(verifyChain(chain, publicKey)).toBe(true);
  }
);

// Property: mutating any receipt field breaks verifyChain()
fc.property(
  fc.array(..., { minLength: 2 }),
  fc.nat(),
  fc.string({ minLength: 1 }),
  async (inputs, idx, mutation) => {
    const chain = await buildChain(inputs, keyPair);
    const tampered = chain.map((r, i) =>
      i === idx % chain.length ? { ...r, url: mutation } : r
    );
    expect(verifyChain(tampered, publicKey)).toBe(false);
  }
);

// Property: canonicalJson output is key-order-independent
fc.property(
  fc.record({ a: fc.string(), b: fc.integer(), c: fc.boolean() }),
  (obj) => {
    const shuffled = shuffleKeys(obj);
    expect(canonicalJson(obj)).toEqual(canonicalJson(shuffled));
  }
);
```

### `crypto.test.ts`

```typescript
// Property: sign then verify round-trip
fc.property(fc.uint8Array({ minLength: 1, maxLength: 1024 }), async (data) => {
  const { privateKey, publicKey } = await generateKeyPair();
  const sig = await sign(data, privateKey);
  expect(await verify(data, sig, publicKey)).toBe(true);
});

// Property: tampered data fails verification
fc.property(
  fc.uint8Array({ minLength: 2 }),
  fc.integer({ min: 0, max: 255 }),
  async (data, flip) => {
    const { privateKey, publicKey } = await generateKeyPair();
    const sig = await sign(data, privateKey);
    const tampered = new Uint8Array(data);
    tampered[0] ^= flip | 1; // ensure at least one bit differs
    expect(await verify(tampered, sig, publicKey)).toBe(false);
  }
);
```

---

## UI Component Responsibilities

| Component | Kind | Responsibility |
|---|---|---|
| `SearchForm` | Client | Controlled input, URL validation, submit handler calling `/api/resurrect`, loading state |
| `TombstoneCard` | Server | Renders a single result (title, last-push date, archive date) as a tombstone layout |
| `FogOverlay` | Client | Absolutely-positioned fog CSS animation; `motion-reduce:hidden` |
| `ReceiptChainViewer` | Client | Expandable list of receipts; "Export JSON" button triggering file download |
| `RevivalSpecPanel` | Client | Accordion of revival steps; lists stale deps with badges |

---

## Bundled restoration (reconciled with the workbench)

The generic revival checklist does not rewrite source. A separate `/lantern-hill` page demonstrates a bounded HTML rewrite of an original MIT-licensed fixture. It preserves the existing workbench, `/api/resurrect`, and the evidence-bound `gravekeeper-proof-v1` format.

`buildLanternHillDemo()` loads `src/lib/restore/fixture.ts`, runs `restoreDeadHtml()`, and signs the exact before and after HTML bytes with a fresh ephemeral Ed25519 key. No upstream request is made. Both previews are sandboxed; fixture routes also apply a restrictive CSP. The fixture URL is an identifier, not a deployed website.

| seq | kind | body hashed |
|---|---|---|
| 0 | `fixture` | before HTML |
| 1 | `restoration` | after HTML |

`buildReceiptExport()` writes `{ gravekeeper: "receipt-export", version: 1, publicKey, receipts, artifacts }`. `verifyReceiptExport()` rejects empty/malformed chains, recomputes links and signatures, and checks hashes for included artifacts. The browser calls that function directly. `POST /api/verify` provides the same check over HTTP. This export format is separate from the existing live lookup proof.

Verification means internal consistency, not authorship or historical provenance. Missing artifacts are not verified; replacing the entire file/key or removing a valid suffix is undetectable without a trusted external anchor. The HTML rewriter is scoped to the bundled fixture, not a general sanitizer or live-site rewriting service.
