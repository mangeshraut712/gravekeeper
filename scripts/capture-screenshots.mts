// Captures the README screenshots into docs/screenshots/ from a running app.
// Usage: BASE_URL=http://localhost:3000 node scripts/capture-screenshots.mts
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own)
// No network is needed: /api/resurrect is mocked in the browser with a response built here
// from SYNTHETIC repository data (example/abandoned-widget) and signed with the project's own
// receipt code, so the displayed proof verifies. It is not a live GitHub/Wayback lookup.
// --live additionally performs a REAL atom/atom lookup (needs network, may be partial) and writes home-lookup-live.png.
// Without --live the default mocked run is unchanged.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import type { Receipt } from "../src/types/index.ts";
import { generateKeyPair, exportPublicKey } from "../src/lib/receipts/crypto.ts";
import { buildReceipt } from "../src/lib/receipts/chain.ts";
import { generateRevivalSpec } from "../src/lib/spec/generator.ts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = new URL("../docs/screenshots/", import.meta.url).pathname;
await mkdir(out, { recursive: true });

const repoUrl = "https://github.com/example/abandoned-widget";
const wayback = {
  available: true,
  url: repoUrl,
  snapshotUrl: "https://web.archive.org/web/20190412093000/" + repoUrl,
  timestamp: "20190412093000",
  status: "200",
};
const meta = {
  owner: "example",
  repo: "abandoned-widget",
  fullName: "example/abandoned-widget",
  description: "Synthetic example repository used for documentation screenshots.",
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
const receipts: unknown[] = [];
const evidence: unknown[] = [];
let prev: Receipt | null = null;
async function record(kind: string, source: string, payload: unknown) {
  const r = await buildReceipt(prev, kind as never, source, new TextEncoder().encode(JSON.stringify(payload)), privateKey);
  prev = r;
  receipts.push(r);
  evidence.push({ receiptSeq: r.seq, body: payload });
}
const metaUrl = "https://api.github.com/repos/example/abandoned-widget";
await record("wayback", repoUrl, wayback);
await record("github-meta", metaUrl, meta);
await record("github-commits", `${metaUrl}/commits?per_page=20`, commits);
await record("spec", repoUrl, spec);
const mocked = { receipts, evidence, spec, wayback, github: { meta, commits }, publicKey: await exportPublicKey(publicKey) };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
async function settle(page: import("playwright").Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number)).map((a) => a.finished)));
}
async function shot(name: string, path: string, opts: { reduced?: boolean; full?: boolean; lookup?: boolean; live?: string } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  if (opts.lookup) {
    await page.route("**/api/resurrect", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mocked) }));
  }
  await page.goto(base + path, { waitUntil: "networkidle" });
  if (opts.lookup) {
    await page.locator("#resource-url").fill(repoUrl);
    await page.getByRole("button", { name: /unearth project/i }).click();
    await page.getByRole("heading", { name: /example\/abandoned-widget|abandoned-widget/i }).first().waitFor();
  }
  if (opts.live) {
    await page.locator("#resource-url").fill(opts.live);
    await page.getByRole("button", { name: /unearth project/i }).click();
    await page.getByText("Lookup complete").waitFor({ timeout: 45_000 });
  }
  await settle(page);
  await page.screenshot({ path: out + name, fullPage: opts.full ?? false, type: "png" });
  console.log("wrote", name);
  await ctx.close();
}

await shot("home.png", "/");
await shot("home-reduced-motion.png", "/", { reduced: true });
await shot("home-lookup.png", "/", { lookup: true, full: true });
await shot("restoration.png", "/restoration", { full: true });
await shot("lantern-hill.png", "/lantern-hill", { full: true });
if (process.argv.includes("--live")) await shot("home-lookup-live.png", "/", { live: "https://github.com/atom/atom", full: true });
await browser.close();
