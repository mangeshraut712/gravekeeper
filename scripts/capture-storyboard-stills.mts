// Captures the demo-storyboard stills that were missing (docs/submission/DEMO_STORYBOARD.md):
// the Epitaph table opened, the Dependency autopsy table at viewport size, the Revival kit after
// Download revival kit and Copy issue body with both status messages, and /proof with a Valid verdict.
// Usage: BASE_URL=http://localhost:3000 node scripts/capture-storyboard-stills.mts [--live]
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own)
// Default: /api/resurrect is mocked with the SYNTHETIC signed lookup from scripts/synthetic-lookup.mts
// (example/abandoned-widget, invented data); no network. Files end in -synthetic.png.
// --live: also performs a REAL https://github.com/atom/atom lookup through the app (needs network; the
// result depends on GitHub, the Internet Archive and npm). Its proof is downloaded with Download proof and
// loaded into /proof through the file input. Files end in -atom.png.
// 1440x900 viewport, reduced motion (the fog is hidden). Every state is waited for; a miss throws.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";
import { exportProof } from "../src/client/proof.ts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const live = process.argv.includes("--live");
const out = new URL("../docs/screenshots/live/storyboard/", import.meta.url).pathname;
await mkdir(out, { recursive: true });
const tmp = await mkdtemp(join(tmpdir(), "gk-stills-"));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function scrollTo(page: Page, selector: string, offset: number) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: "visible" });
  await el.evaluate((e, o) => window.scrollTo(0, e.getBoundingClientRect().top + window.scrollY - o), offset);
  await page.waitForTimeout(300);
}

async function run(label: "synthetic" | "atom") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce", acceptDownloads: true });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  let url = "https://github.com/atom/atom";
  let proofText: string | null = null;
  if (label === "synthetic") {
    const synthetic = await buildSyntheticLookup();
    url = syntheticRepoUrl;
    proofText = exportProof(synthetic as never, syntheticRepoUrl);
    await page.route("**/api/resurrect", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(synthetic) }));
  }
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.fill("#resource-url", url);
  await page.click("button[type=submit]");
  await page.getByText("Lookup complete").waitFor({ timeout: 60_000 });
  for (const id of ["epitaph-title", "autopsy-title", "kit-title", "proof-title"]) await page.locator(`#${id}`).waitFor({ state: "visible" });

  // (a) Epitaph table opened from its own disclosure.
  const epitaph = page.locator("section[aria-labelledby='epitaph-title']");
  await epitaph.getByText("Show captures per year as a table").click();
  await epitaph.getByText("Months with a capture").waitFor({ state: "visible" });
  await scrollTo(page, "section[aria-labelledby='epitaph-title']", 24);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: out + `epitaph-table-open-${label}.png` });

  // (b) Dependency autopsy table in the viewport.
  if ((await page.locator("#autopsy-table-caption").count()) !== 1) throw new Error("autopsy table missing");
  await scrollTo(page, "section[aria-labelledby='autopsy-title']", 24);
  await page.screenshot({ path: out + `autopsy-table-${label}.png` });

  // (c) Revival kit after both buttons, with both status messages.
  const [kit] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download revival kit" }).click()]);
  if (kit.suggestedFilename() !== "REVIVAL.md") throw new Error("kit download has the wrong name");
  await page.locator("#kit-download-status").getByText("REVIVAL.md downloaded").waitFor();
  await page.getByRole("button", { name: "Copy issue body" }).click();
  await page.locator("#kit-copy-status").getByText("Issue body copied.").waitFor({ timeout: 10_000 });
  await scrollTo(page, "section[aria-labelledby='kit-title']", 160);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: out + `kit-status-${label}.png` });

  // (d) /proof Valid. Live: the file from Download proof, loaded through the file input.
  let proofFile: string | null = null;
  if (label === "atom") {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download proof/ }).click()]);
    proofFile = join(tmp, dl.suggestedFilename());
    await dl.saveAs(proofFile);
  }
  await page.goto(base + "/proof", { waitUntil: "networkidle" });
  if (proofFile) {
    await page.setInputFiles("#proof-file", proofFile);
  } else {
    await page.fill("#proof-paste", proofText!);
    await page.getByRole("button", { name: "Verify pasted text" }).click();
  }
  await page.locator("#proof-result").waitFor({ timeout: 10_000 });
  const verdict = await page.locator("#proof-result").innerText();
  if (!verdict.startsWith("Valid")) throw new Error(`/proof expected Valid for ${label}, got: ${verdict.slice(0, 60)}`);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: out + `proof-valid-${label}.png` });
  console.log(`${label}: 4 stills written (verdict: ${verdict.split("\n")[0]})${proofFile ? `; proof file ${proofFile}` : ""}`);
  await ctx.close();
}

try {
  await run("synthetic");
  if (live) await run("atom");
} finally {
  await browser.close();
  if (!process.env.KEEP_PROOF) await rm(tmp, { recursive: true, force: true });
}
