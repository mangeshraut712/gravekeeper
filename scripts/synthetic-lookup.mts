// A SYNTHETIC signed /api/resurrect response (repository example/abandoned-widget, invented
// data), signed with the project's own receipt code so the displayed proof verifies.
// Used by scripts/polish-check.mts. It is not a live GitHub or Wayback lookup.
import type { Receipt } from "../src/types/index.ts";
import { generateKeyPair, exportPublicKey } from "../src/lib/receipts/crypto.ts";
import { buildReceipt } from "../src/lib/receipts/chain.ts";
import { generateRevivalSpec } from "../src/lib/spec/generator.ts";

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
  const spec = generateRevivalSpec(meta, commits);
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
  await record("github-meta", metaUrl, meta);
  await record("github-commits", `${metaUrl}/commits?per_page=20`, commits);
  await record("spec", syntheticRepoUrl, spec);
  return { receipts, evidence, spec, wayback, github: { meta, commits }, publicKey: await exportPublicKey(publicKey) };
}
