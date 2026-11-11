// WCAG 2.1 A/AA scan with axe-core on the public routes.
// Usage: BASE_URL=http://localhost:3000 node scripts/a11y-audit.mts [--lookup]
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own)
//   --lookup       also scan the results state after a real atom/atom lookup (needs network)
import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const withLookup = process.argv.includes("--lookup");
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
let total = 0;
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
    await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))); // axe must not sample mid-fade
    await scan("/ (after atom/atom lookup, proof-section receipt details open)", page);
  }
  await page.context().close();
}
await browser.close();
console.log(total === 0 ? "RESULT: no violations in scanned states" : `RESULT: ${total} violation(s)`);
process.exit(total === 0 ? 0 : 1);
