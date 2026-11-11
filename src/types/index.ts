// Receipt types

export type ReceiptKind =
  | 'wayback'
  | 'wayback-miss'
  | 'github-meta'
  | 'github-commits'
  | 'spec'
  | 'fork'
  | 'fixture'
  | 'restoration'
  | 'github-manifest'
  | 'registry'
  | 'wayback-cdx';

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

// Internet Archive CDX life span (epitaph timeline)

export type CdxEvidence = {
  limit: number;          // always CDX_LIMIT
  timestamps: string[];   // 14-digit UTC timestamps, non-decreasing, one per captured month
};

export type TimelineYear = { year: number; months: number }; // months with at least one capture

export type EpitaphTimeline = {
  state: 'complete' | 'truncated' | 'empty' | 'unavailable';
  code: string | null;          // error code when unavailable
  firstCapture: string | null;  // 14-digit timestamp
  lastSeen: string | null;      // first capture in the latest captured month
  capturedMonths: number;
  yearsOnRecord: number;        // first year to last year, inclusive
  yearsWithCaptures: number;
  years: TimelineYear[];        // every year in the span, ascending
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

// Dependency autopsy types

export type Ecosystem = 'npm' | 'pypi';

export type DependencyStatus =
  | 'current'
  | 'minor-behind'
  | 'major-behind'
  | 'unknown'
  | 'not-found';

export type DeclaredDependency = {
  name: string;
  spec: string; // exactly as declared ("" when unpinned)
  group: 'dependencies' | 'devDependencies' | 'requirements' | 'project';
};

export type ManifestPath = 'package.json' | 'requirements.txt' | 'pyproject.toml';

export type ManifestEvidence = {
  path: ManifestPath;
  ecosystem: Ecosystem;
  rawSha256: string; // SHA-256 hex of the raw manifest bytes from GitHub
  totalDeclared: number;
  skippedLines: number;
  truncated: boolean;
  packages: DeclaredDependency[]; // at most 40
};

export type RegistryOutcome = 'ok' | 'not-found' | 'error' | 'skipped';

export type RegistryEvidence = {
  registry: string;
  results: { name: string; latest: string | null; outcome: RegistryOutcome }[];
};

export type AutopsyDependency = DeclaredDependency & {
  floor: string | null;
  latest: string | null;
  status: DependencyStatus;
  note: string | null;
};

export type DependencyAutopsy = {
  state: 'complete' | 'partial' | 'no-manifest' | 'unavailable';
  manifest: Omit<ManifestEvidence, 'packages'> | null;
  dependencies: AutopsyDependency[];
  counts: Record<DependencyStatus, number>;
};

export type RestorationChange = {
  rule: string;
  summary: string;
  count: number;
};

/** A concrete before/after HTML restoration, not only a checklist. */
export type RestorationResult = {
  fixtureId: string;
  title: string;
  license: string;
  disclosure: string;
  beforeHtml: string;
  afterHtml: string;
  changes: RestorationChange[];
  beforePath: string;
  afterPath: string;
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
  restoration?: RestorationResult | null;
  autopsy?: DependencyAutopsy | null; // absent in proofs made before the dependency autopsy
  timeline?: EpitaphTimeline | null;  // absent in proofs made before the epitaph timeline
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
  | 'FORK_FAILED'
  | 'MANIFEST_NOT_FOUND';

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ErrorCode };
