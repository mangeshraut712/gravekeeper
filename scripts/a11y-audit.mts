// WCAG 2.1 A/AA scan with axe-core on the public routes.
// Usage: BASE_URL=http://localhost:3000 node scripts/a11y-audit.mts [--lookup] [--browser=firefox] [--browsers=chromium,firefox,webkit]
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own; chromium only)
//   --browser / --browsers  engines to scan (default chromium). A browser that cannot launch fails the run.
//   --lookup       also scan the results state after a real atom/atom lookup (needs network)
// Always scanned, with /api/resurrect mocked (no network): invalid-URL, server-error, running and canceled states,
// a synthetic signed lookup (Epitaph, Dependency autopsy, Revival kit), and /proof valid and invalid verdicts.
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, firefox, webkit } from "playwright";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";
import { exportProof } from "../src/client/proof.ts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const withLookup = process.argv.includes("--lookup");
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const engines = { chromium, firefox, webkit } as const;
type EngineName = keyof typeof engines;
const flag = process.argv.find((a) => a.startsWith("--browsers=") || a.startsWith("--browser="));
const requested = (flag ? flag.slice(flag.indexOf("=") + 1).split(",") : ["chromium"]).map((b) => b.trim()).filter(Boolean);
for (const b of requested) {
  if (!(b in engines)) throw new Error(`unknown browser "${b}" (use chromium, firefox or webkit)`);
}
const synthetic = await buildSyntheticLookup();
const proofText = exportProof(synthetic as never, syntheticRepoUrl);
let total = 0;
const perBrowser: string[] = [];
for (const engineName of requested as EngineName[]) {
let browser: import("playwright").Browser;
try {
  browser = await engines[engineName].launch(
    engineName === "chromium" ? { executablePath: process.env.CHROMIUM_PATH || undefined } : {},
  );
} catch (err) {
  console.error(`FAILED to launch ${engineName}: ${(err as Error).message.split("\n")[0]}`);
  process.exit(2);
}
const before = total;
console.log(`\n=== ${engineName} ${browser.version()} ===`);
// The "before" fixture is deliberately an inaccessible 1999-style page (blink, marquee,
// unlabeled inputs); it is the thing being restored, so its findings are reported but not counted.
const expectedFindings = new Set(["/fixtures/lantern-hill/before"]);
async function scan(name: string, page: import("playwright").Page, expected = false) {
  // Sandboxed preview iframes cannot host axe; their documents are scanned directly below.
  const { violations, passes, incomplete } = await new AxeBuilder({ page })
    .withTags(tags)
    .exclude("iframe")
    .analyze();
  if (!expected) total += violations.length;
  console.log(
    `${name}${expected ? " [intentionally inaccessible fixture]" : ""}: ${violations.length} violations, ${passes.length} rules passed, ${incomplete.length} need manual review`,
  );
  for (const v of violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 5)) {
      console.log(`    ${n.target.join(" ")}`);
      const m = n.any[0]?.message;
      if (m) console.log(`      ${m}`);
    }
  }
  for (const i of incomplete) console.log(`  (review) ${i.id}: ${i.nodes.length} node(s)`);
}
for (const path of [
  "/",
  "/restoration",
  "/lantern-hill",
  "/proof",
  "/fixtures/lantern-hill/before",
  "/fixtures/lantern-hill/after",
]) {
  // bypassCSP only lets the scanner run; it does not change the page markup.
  const page = await (await browser.newContext({ bypassCSP: true })).newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await scan(path, page, expectedFindings.has(path));
  if (path === "/" && withLookup) {
    await page.fill("#resource-url", "https://github.com/atom/atom");
    await page.click("button[type=submit]");
    await page.getByText("Lookup complete").waitFor({ timeout: 45_000 });
    // RevivalSpecPanel precedes ReceiptChainViewer, so the first <details> on
    // the page is "Detected stack". Scope opening to the proof section and
    // fail if the receipt bodies never appear (do not treat a miss as success).
    const proof = page.locator("section[aria-labelledby='proof-title']");
    await proof.waitFor();
    const receipts = proof.locator("details");
    if ((await receipts.count()) === 0) {
      throw new Error("proof section has no receipt details to open");
    }
    await receipts.evaluateAll((nodes) => {
      for (const node of nodes) (node as HTMLDetailsElement).open = true;
    });
    for (const label of ["Resource", "Recorded at", "Receipt hash", "Content digest"]) {
      await proof.getByText(label, { exact: true }).first().waitFor({ state: "visible" });
    }
    await settleImpl(page); // axe must not sample mid-fade
    await scan("/ (after atom/atom lookup, proof-section receipt details open)", page);
  }
  await page.context().close();
}

// Lookup error and cancel states. /api/resurrect is mocked with page.route so these
// states are deterministic and need no network. Each step throws if the state is not
// actually reached, so a page never reports "0 violations" for a state it did not enter.
// Wait for finite animations, but never forever: in headless Firefox the 200 ms fade-in
// can fail to report "finished" after the lookup, so the wait is capped at 2 s.
async function settleImpl(page: import("playwright").Page) {
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number) && a.playState === "running").map((a) => a.finished.catch(() => undefined))),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]));
  await page.waitForTimeout(300);
}
// Only a failed URL validation marks the field invalid; server errors and cancel do not.
async function expectStatus(page: import("playwright").Page, text: string, invalid: boolean) {
  const status = page.locator("#lookup-error");
  await status.getByText(text).waitFor({ state: "visible", timeout: 10_000 });
  const expected = String(invalid);
  if ((await page.locator("#resource-url").getAttribute("aria-invalid")) !== expected) {
    throw new Error(`expected aria-invalid=${expected} on the URL input for: ${text}`);
  }
}
{
  // 1. Client-side validation error (no request is made).
  const page = await (await browser.newContext({ bypassCSP: true })).newPage();
  let requested = false;
  await page.route("**/api/resurrect", (route) => { requested = true; return route.abort(); });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.fill("#resource-url", "not a url");
  await page.click("button[type=submit]");
  await expectStatus(page, "Enter a public HTTP(S) URL", true);
  if (requested) throw new Error("validation error state made a network request");
  await settleImpl(page);
  await scan("/ (invalid URL error state)", page);
  await page.context().close();
}
{
  // 2. Server error response shown by the form.
  const message = "Repository not found or not public.";
  const page = await (await browser.newContext({ bypassCSP: true })).newPage();
  await page.route("**/api/resurrect", (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: message }) }));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.fill("#resource-url", "https://github.com/example/missing");
  await page.click("button[type=submit]");
  await expectStatus(page, message, false);
  await settleImpl(page);
  await scan("/ (lookup error state, mocked 404)", page);
  await page.context().close();
}
{
  // 3. Cancel: the mocked request never completes, so the form stays in its loading state until Cancel.
  const page = await (await browser.newContext({ bypassCSP: true })).newPage();
  await page.route("**/api/resurrect", () => new Promise<void>(() => {}));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.fill("#resource-url", "https://github.com/example/slow");
  await page.click("button[type=submit]");
  const cancel = page.getByRole("button", { name: "Cancel" });
  await cancel.waitFor({ state: "visible", timeout: 10_000 });
  await settleImpl(page);
  await scan("/ (lookup running, Cancel button visible)", page);
  await page.keyboard.press("Escape");
  await expectStatus(page, "Lookup canceled. You can start another one.", false);
  if (await cancel.count()) throw new Error("Cancel button still present after Escape");
  await settleImpl(page);
  await scan("/ (lookup canceled state)", page);
  await page.context().close();
}
{
  // 4. Full results state from a SYNTHETIC signed lookup (scripts/synthetic-lookup.mts,
  // example/abandoned-widget, invented data): Epitaph, Dependency autopsy, revival plan,
  // receipts and Revival kit all render with data. Disclosures are opened, Verify proof,
  // Download revival kit and Copy issue body are pressed, and each status message must
  // appear before axe runs.
  const ctx = await browser.newContext({ bypassCSP: true, acceptDownloads: true });
  if (engineName === "chromium") await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  await page.route("**/api/resurrect", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(synthetic) }));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.fill("#resource-url", syntheticRepoUrl);
  await page.click("button[type=submit]");
  await page.getByText("Lookup complete").waitFor({ timeout: 15_000 });
  for (const id of ["epitaph-title", "autopsy-title", "kit-title", "proof-title"]) {
    await page.locator(`#${id}`).waitFor({ state: "visible" });
  }
  if ((await page.locator("#autopsy-table-caption").count()) !== 1) throw new Error("autopsy table missing");
  await settleImpl(page);
  await scan("/ (synthetic lookup: Epitaph, autopsy, plan, receipts, kit; collapsed)", page);
  await page.locator("details").evaluateAll((nodes) => {
    for (const node of nodes) (node as HTMLDetailsElement).open = true;
  });
  await page.getByText("Months with a capture").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Verify proof" }).click();
  await page.getByText(/internally consistent/).first().waitFor({ timeout: 10_000 });
  const [kitDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download revival kit" }).click(),
  ]);
  if (kitDownload.suggestedFilename() !== "REVIVAL.md") throw new Error("kit download has the wrong name");
  await page.locator("#kit-download-status").getByText("REVIVAL.md downloaded").waitFor();
  await page.getByRole("button", { name: "Copy issue body" }).click();
  // Clipboard access differs by engine; either outcome is a status message, and an empty region fails.
  await page.locator("#kit-copy-status").getByText(/Issue body copied|Could not copy/).waitFor({ timeout: 10_000 });
  await settleImpl(page);
  await scan("/ (synthetic lookup: all disclosures open, proof verified, kit downloaded, issue body copy status)", page);
  await ctx.close();
}
{
  // 5. /proof with a verdict: the synthetic lookup's proof file pasted in (valid), then the same
  // file with one receipt URL changed (invalid). The verdict heading must appear before axe runs.
  const page = await (await browser.newContext({ bypassCSP: true })).newPage();
  const verdict = async (text: string, expected: "Valid" | "Invalid") => {
    await page.fill("#proof-paste", text);
    await page.getByRole("button", { name: "Verify pasted text" }).click();
    await page.locator("#proof-result").waitFor({ timeout: 10_000 });
    const shown = await page.locator("#proof-result").innerText();
    if (!shown.startsWith(expected)) throw new Error(`/proof expected ${expected}, got: ${shown.slice(0, 60)}`);
    await settleImpl(page);
  };
  await page.goto(base + "/proof", { waitUntil: "networkidle" });
  await verdict(proofText, "Valid");
  await scan("/proof (valid synthetic lookup proof)", page);
  const tampered = JSON.parse(proofText);
  tampered.receipts[1].url = "https://evil.test/";
  await page.goto(base + "/proof", { waitUntil: "networkidle" });
  await verdict(JSON.stringify(tampered), "Invalid");
  await scan("/proof (tampered proof, invalid)", page);
  await page.context().close();
}
await browser.close();
perBrowser.push(`${engineName}: ${total - before} violation(s)`);
}
console.log("\nPer browser: " + perBrowser.join("; "));
console.log(total === 0 ? "RESULT: no violations in scanned states" : `RESULT: ${total} violation(s)`);
process.exit(total === 0 ? 0 : 1);
