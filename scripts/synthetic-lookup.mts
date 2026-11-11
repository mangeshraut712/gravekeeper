// A SYNTHETIC signed /api/resurrect response (repository example/abandoned-widget, invented
// data), signed with the project's own receipt code so the displayed proof verifies.
// Used by scripts/polish-check.mts and scripts/a11y-audit.mts. It is not a live GitHub or
// Wayback lookup. It includes the Epitaph capture index, a package.json manifest and npm
// registry results, so the Epitaph, Dependency autopsy and Revival kit panels all render
// with data, in the same receipt order as /api/resurrect.
import type { ManifestEvidence, Receipt, RegistryEvidence } from "../src/types/index.ts";
import { generateKeyPair, exportPublicKey } from "../src/lib/receipts/crypto.ts";
import { buildReceipt } from "../src/lib/receipts/chain.ts";
import { generateRevivalSpec } from "../src/lib/spec/generator.ts";
import { REGISTRY_BASE, buildAutopsy } from "../src/lib/deps/autopsy.ts";
import { CDX_LIMIT, buildTimeline, cdxQueryUrl } from "../src/lib/wayback/timeline.ts";

export const syntheticRepoUrl = "https://github.com/example/abandoned-widget";

export async function buildSyntheticLookup() {
  const wayback = {
    available: true,
    url: syntheticRepoUrl,
    snapshotUrl: "https://web.archive.org/web/20190412093000/" + syntheticRepoUrl,
    timestamp: "20190412093000",
    status: "200",
  };
  const meta = {
    owner: "example",
    repo: "abandoned-widget",
    fullName: "example/abandoned-widget",
    description: "Synthetic example repository used by the polish check.",
    stars: 1280,
    forks: 94,
    openIssues: 42,
    license: "MIT",
    defaultBranch: "main",
    pushedAt: "2019-03-02T10:15:00.000Z",
    archivedByGitHub: true,
    language: "JavaScript",
  };
  const commits = [
    ["a1b2c3d", "Bump version to 2.1.4", "2019-03-02T10:15:00.000Z"],
    ["b2c3d4e", "Fix flaky timer test", "2019-02-20T08:00:00.000Z"],
    ["c3d4e5f", "Update README badges", "2019-01-11T17:40:00.000Z"],
  ].map(([sha, message, authorDate]) => ({ sha, message, authorDate, authorName: "Example Maintainer" }));
  // Synthetic monthly capture index: 2014-2019 with a gap year in 2017.
  const cdx = {
    limit: CDX_LIMIT,
    timestamps: ["20140622190015", "20141101000000", "20150301000000", "20160705000000", "20180210000000", "20190412093000"],
  };
  const manifest: ManifestEvidence = {
    path: "package.json",
    ecosystem: "npm",
    rawSha256: "a".repeat(64),
    totalDeclared: 5,
    skippedLines: 0,
    truncated: false,
    packages: [
      { name: "react", spec: "^16.14.0", group: "dependencies" },
      { name: "lodash", spec: "^4.17.0", group: "dependencies" },
      { name: "left-pad", spec: "1.3.0", group: "dependencies" },
      { name: "ghost-pkg", spec: "^1.0.0", group: "devDependencies" },
      { name: "jest", spec: "*", group: "devDependencies" },
    ],
  };
  const registry: RegistryEvidence = {
    registry: REGISTRY_BASE.npm,
    results: [
      { name: "react", latest: "19.2.0", outcome: "ok" },
      { name: "lodash", latest: "4.17.21", outcome: "ok" },
      { name: "left-pad", latest: "1.3.0", outcome: "ok" },
      { name: "ghost-pkg", latest: null, outcome: "not-found" },
      { name: "jest", latest: "30.0.0", outcome: "ok" },
    ],
  };
  const autopsy = buildAutopsy(manifest, registry);
  const timeline = buildTimeline(cdx);
  const spec = generateRevivalSpec(meta, commits, autopsy);
  const { privateKey, publicKey } = await generateKeyPair();
  const receipts: Receipt[] = [];
  const evidence: { receiptSeq: number; body: unknown }[] = [];
  let prev: Receipt | null = null;
  async function record(kind: string, source: string, payload: unknown) {
    const r = await buildReceipt(prev, kind as never, source, new TextEncoder().encode(JSON.stringify(payload)), privateKey);
    prev = r;
    receipts.push(r);
    evidence.push({ receiptSeq: r.seq, body: payload });
  }
  const metaUrl = "https://api.github.com/repos/example/abandoned-widget";
  await record("wayback", syntheticRepoUrl, wayback);
  await record("wayback-cdx", cdxQueryUrl(syntheticRepoUrl), cdx);
  await record("github-meta", metaUrl, meta);
  await record("github-commits", `${metaUrl}/commits?per_page=20`, commits);
  await record("github-manifest", `${metaUrl}/contents/package.json?ref=main`, manifest);
  await record("registry", registry.registry, registry);
  await record("spec", syntheticRepoUrl, spec);
  return {
    receipts,
    evidence,
    spec,
    wayback,
    github: { meta, commits },
    autopsy,
    timeline,
    publicKey: await exportPublicKey(publicKey),
  };
}
