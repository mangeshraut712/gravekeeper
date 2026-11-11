// Browser end-to-end smoke test against a running Gravekeeper build.
// Usage: BASE_URL=http://localhost:3000 node scripts/e2e-smoke.mts
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own)
// No upstream network is used. /api/resurrect is mocked in the browser with a SYNTHETIC
// response (repository example/abandoned-widget, invented data) that is signed here with
// the project's own receipt code, the same approach as scripts/capture-screenshots.mts.
// It checks the UI and the proof round trip, not live GitHub or Wayback behaviour.
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import type { Browser, Page } from "playwright";
import type { Receipt } from "../src/types/index.ts";
import { generateKeyPair, exportPublicKey } from "../src/lib/receipts/crypto.ts";
import { buildReceipt } from "../src/lib/receipts/chain.ts";
import { generateRevivalSpec } from "../src/lib/spec/generator.ts";
import fixtures from "../src/lib/restoration/fixtures.json" with { type: "json" };

const base = process.env.BASE_URL ?? "http://localhost:3000";
const verifier = new URL("./verify-proof.ts", import.meta.url).pathname;

// ---------- synthetic signed lookup response ----------
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
  description: "Synthetic example repository used by the e2e smoke test.",
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
await record("wayback", repoUrl, wayback);
await record("github-meta", metaUrl, meta);
await record("github-commits", `${metaUrl}/commits?per_page=20`, commits);
await record("spec", repoUrl, spec);
const mocked = { receipts, evidence, spec, wayback, github: { meta, commits }, publicKey: await exportPublicKey(publicKey) };

// ---------- harness ----------
const failures: string[] = [];
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function step(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
    failures.push(`${name}: ${message}`);
    console.log(`FAIL ${name}\n     ${message}`);
  }
}
async function withPage(browser: Browser, opts: { reduced?: boolean }, fn: (page: Page) => Promise<void>) {
  const ctx = await browser.newContext({ reducedMotion: opts.reduced ? "reduce" : "no-preference", acceptDownloads: true });
  try {
    await fn(await ctx.newPage());
  } finally {
    await ctx.close();
  }
}
function runVerifier(file: string) {
  const run = spawnSync(process.execPath, [verifier, file], { encoding: "utf8" });
  return { status: run.status, output: (run.stdout + run.stderr).trim() };
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const work = await mkdtemp(join(tmpdir(), "gravekeeper-e2e-"));
console.log(`e2e smoke against ${base} (synthetic lookup data: example/abandoned-widget)`);

await step("home renders the search form", () =>
  withPage(browser, {}, async (page) => {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.locator("#resource-url").waitFor({ state: "visible" });
    assert(await page.locator("label[for='resource-url']").count(), "URL input has no <label for>");
    assert(await page.locator("form button[type=submit]").isEnabled(), "submit button is not enabled");
  }));

await step("fog overlay shows normally and is hidden with reduced motion", async () => {
  await withPage(browser, {}, async (page) => {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    const fog = page.getByTestId("fog-overlay");
    assert((await fog.getAttribute("aria-hidden")) === "true", "fog overlay is not aria-hidden");
    assert(await fog.isVisible(), "fog overlay hidden without reduced-motion preference");
  });
  await withPage(browser, { reduced: true }, async (page) => {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    const fog = page.getByTestId("fog-overlay");
    assert((await fog.count()) === 1, "fog overlay missing from the page");
    assert(!(await fog.isVisible()), "fog overlay still visible with prefers-reduced-motion: reduce");
  });
});

await step("invalid URL shows the inline error without a network call", () =>
  withPage(browser, {}, async (page) => {
    let requested = false;
    await page.route("**/api/resurrect", (route) => {
      requested = true;
      return route.abort();
    });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.fill("#resource-url", "not a url");
    await page.click("form button[type=submit]");
    await page.locator("#lookup-error").getByText("Enter a public HTTP(S) URL").waitFor({ timeout: 10_000 });
    assert((await page.locator("#resource-url").getAttribute("aria-invalid")) === "true", "aria-invalid not set");
    await page.waitForTimeout(300);
    assert(!requested, "a request to /api/resurrect was made for an invalid URL");
  }));

let downloaded = "";
await step("lookup renders tombstone, revival steps and proof; Verify and Download proof work", () =>
  withPage(browser, {}, async (page) => {
    await page.route("**/api/resurrect", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mocked) }));
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.fill("#resource-url", repoUrl);
    await page.click("form button[type=submit]");
    await page.locator("#resource-title").getByText("example/abandoned-widget").waitFor({ timeout: 15_000 });
    await page.getByText("R.I.P.", { exact: true }).last().waitFor();
    const plan = page.locator("section[aria-labelledby='plan-title']");
    await plan.getByText("Revival steps").waitFor();
    const steps = await plan.locator("ol > li").count();
    assert(steps === spec.revivalSteps.length && steps >= 3, `expected ${spec.revivalSteps.length} revival steps, saw ${steps}`);
    const proof = page.locator("section[aria-labelledby='proof-title']");
    await proof.waitFor();
    const shown = await proof.locator("details").count();
    assert(shown === receipts.length, `expected ${receipts.length} receipts in the proof section, saw ${shown}`);

    await proof.getByRole("button", { name: "Verify proof" }).click();
    await proof.getByText("Proof internally consistent").waitFor({ timeout: 15_000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 10_000 }),
      proof.getByRole("button", { name: /Download proof/ }).click(),
    ]);
    assert(download.suggestedFilename() === "gravekeeper-proof.json", `unexpected filename ${download.suggestedFilename()}`);
    downloaded = join(work, "gravekeeper-proof.json");
    await download.saveAs(downloaded);
  }));

await step("offline verifier accepts the downloaded proof", async () => {
  assert(downloaded, "no proof file was downloaded");
  const { status, output } = runVerifier(downloaded);
  assert(status === 0, `verify-proof exited ${status}: ${output}`);
});

await step("offline verifier rejects the proof after one evidence byte changes", async () => {
  assert(downloaded, "no proof file was downloaded");
  const proof = JSON.parse(await readFile(downloaded, "utf8"));
  const body = proof.evidence[1].body as { description: string };
  // Flip one character in the signed GitHub metadata evidence; displayed data is left alone.
  body.description = (body.description[0] === "S" ? "s" : "S") + body.description.slice(1);
  const tampered = join(work, "gravekeeper-proof-tampered.json");
  await writeFile(tampered, JSON.stringify(proof, null, 2));
  const { status, output } = runVerifier(tampered);
  assert(status === 1, `expected exit 1 for tampered proof, got ${status}: ${output}`);
});

await step("/restoration: running every example gives 12/12 after vs 4/12 before", () =>
  withPage(browser, {}, async (page) => {
    await page.goto(base + "/restoration", { waitUntil: "networkidle" });
    let before = 0;
    let after = 0;
    const result = page.locator("[aria-live='polite']").getByText(/Expected for this fixture/);
    for (const fixture of fixtures) {
      await page.selectOption("#restoration-example", fixture.id);
      await page.getByRole("button", { name: "Run both versions" }).click();
      const text = (await result.textContent({ timeout: 5_000 })) ?? "";
      const match = /Before (passes|fails); after (passes|fails)/.exec(text);
      assert(match, `no pass/fail line for fixture ${fixture.id}`);
      if (match[1] === "passes") before++;
      if (match[2] === "passes") after++;
    }
    const total = fixtures.length;
    assert(total === 12, `expected 12 fixtures, found ${total}`);
    assert(after === 12 && before === 4, `in-browser run gave after ${after}/${total}, before ${before}/${total}`);
    await page.getByText("12/12", { exact: true }).waitFor();
    await page.getByText("4/12", { exact: true }).waitFor();
  }));

await step("/lantern-hill: Verify HTML receipts reports valid", () =>
  withPage(browser, {}, async (page) => {
    await page.goto(base + "/lantern-hill", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Verify HTML receipts" }).click();
    await page.getByText("Both HTML documents match their signed receipts").waitFor({ timeout: 15_000 });
  }));

await browser.close();
if (failures.length) {
  console.error(`\nRESULT: ${failures.length} e2e check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nRESULT: all e2e smoke checks passed");
