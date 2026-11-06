// Receipt types

export type ReceiptKind =
  | 'wayback'
  | 'wayback-miss'
  | 'github-meta'
  | 'github-commits'
  | 'spec'
  | 'fork';

export type Receipt = {
  seq: number;             // 0-based, monotonically increasing
  prevHash: string | null; // null for seq=0; SHA-256 hex of previous receipt's canonical JSON
  hash: string;            // SHA-256 hex of this receipt's canonical JSON (sorted keys, excl. hash & signature)
  kind: ReceiptKind;
  url: string;             // The external URL that was fetched
  fetchedAt: string;       // ISO 8601 UTC, e.g. "2026-11-03T06:09:00.000Z"
  contentSha256: string;   // SHA-256 hex of the raw response body bytes
  signature: string;       // base64url Ed25519 signature over canonical JSON
};

// Wayback Machine types

export type WaybackResult = {
  available: boolean;
  url: string;                 // original queried URL
  snapshotUrl: string | null;
  timestamp: string | null;    // e.g. "20231015120000"
  status: string | null;       // HTTP status of the original archived page
};

// GitHub types

export type GitHubRepoMeta = {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  license: string | null;
  defaultBranch: string;
  pushedAt: string;            // ISO 8601
  archivedByGitHub: boolean;
};

export type Commit = {
  sha: string;
  message: string;    // first line only
  authorDate: string; // ISO 8601
  authorName: string;
};

// Revival Spec types

export type StaleDep = {
  name: string;
  detectedVersion: string | null;
  reason: 'outdated' | 'archived' | 'renamed' | 'unknown';
  suggestion: string | null;
};

export type RevivalStep = {
  order: number;
  title: string;
  description: string;
};

export type RevivalSpec = {
  detectedLanguages: string[];
  detectedFramework: string | null;
  staleDeps: StaleDep[];
  revivalSteps: RevivalStep[];
  generatedAt: string; // ISO 8601 UTC
};

// API response type

export type ResurrectResponse = {
  receipts: Receipt[];
  evidence: { receiptSeq: number; body: unknown }[]; // Exact normalized payload hashed by each receipt
  spec: RevivalSpec | null;   // null for Wayback-only lookups
  wayback: WaybackResult | null;
  github: {
    meta: GitHubRepoMeta;
    commits: Commit[];
  } | null;
  publicKey: string;           // base64url-encoded Ed25519 public key for offline verification
};

// Error handling

export type ErrorCode =
  | 'NETWORK_TIMEOUT'
  | 'HTTP_ERROR'
  | 'PARSE_ERROR'
  | 'GITHUB_NOT_FOUND'
  | 'GITHUB_RATE_LIMIT'
  | 'WAYBACK_NO_SNAPSHOT'
  | 'CRYPTO_ERROR'
  | 'FORK_FAILED';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode };
