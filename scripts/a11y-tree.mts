// Accessibility-TREE pass (not a screen-reader pass). Dumps Playwright ARIA snapshots, which show
// the roles, accessible names, states and reading order that Chromium computes, for: the home
// landing state, a SYNTHETIC signed lookup (Epitaph, autopsy, kit used), and /proof Valid/Invalid.
// It never starts VoiceOver, NVDA or any OS accessibility feature; the browser is headless.
// Usage: BASE_URL=http://localhost:3100 node scripts/a11y-tree.mts [outDir]   (default docs/a11y-tree)
// Also asserts structural properties (named controls, one h1, status-region text, no unnamed
// interactive elements) and exits 1 if one fails.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";
import { exportProof } from "../src/client/proof.ts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = process.argv[2] ?? "docs/a11y-tree";
mkdirSync(outDir, { recursive: true });
const synthetic = await buildSyntheticLookup();
const proofText = exportProof(synthetic, syntheticRepoUrl);
const failures: string[] = [];
const check = (state: string, ok: boolean, what: string) => {
  if (!ok) failures.push(`${state}: ${what}`);
};

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ bypassCSP: true, acceptDownloads: true });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();

  async function dump(name: string) {
    await page.waitForTimeout(400);
    // Long values (the pasted proof JSON in the textbox) are truncated so the committed files stay readable and stable.
    const tree = (await page.locator("body").ariaSnapshot())
      .split("\n")
      .map((line) => (line.length > 400 ? line.slice(0, 160) + ` …[${line.length - 160} more characters truncated]` : line))
      .join("\n");
    writeFileSync(`${outDir}/${name}.yml`, tree + "\n");
    // Every interactive element must have a non-empty accessible name (computed by the browser).
    const unnamed = await page.evaluate(() => {
      const out: string[] = [];
      const sel = "a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=link],[tabindex='0']";
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || el.closest("[aria-hidden='true']")) continue;
        const labelled = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
        const labels = (el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []).map((l) => l.textContent?.trim()).join("") : "";
        const text = (el.textContent ?? "").trim();
        if (!labelled && !labels && !text && !el.getAttribute("title")) out.push(el.outerHTML.slice(0, 120));
      }
      return out;
    });
    check(name, unnamed.length === 0, `interactive element(s) with no accessible name: ${unnamed.join(" | ")}`);
    const h1 = await page.locator("h1").count();
    check(name, h1 === 1, `expected exactly one h1, found ${h1}`);
    // Heading levels must not skip downwards by more than one.
    const levels = await page.evaluate(() => Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => Number(h.tagName[1])));
    for (let i = 1; i < levels.length; i++) check(name, levels[i] - levels[i - 1] <= 1, `heading level jumps ${levels[i - 1]} -> ${levels[i]}`);
    console.log(`${name}: ${tree.split("\n").length} lines, headings ${levels.join(",")}, unnamed ${unnamed.length}`);
    return tree;
  }

  await page.goto(base + "/", { waitUntil: "networkidle" });
  await dump("home-landing");

  await page.route("**/api/resurrect", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(synthetic) }));
  await page.fill("#resource-url", syntheticRepoUrl);
  await page.click("button[type=submit]");
  await page.getByText("Lookup complete").waitFor({ timeout: 15_000 });
  await dump("home-results-collapsed");
  await page.locator("details").evaluateAll((nodes) => {
    for (const n of nodes) (n as HTMLDetailsElement).open = true;
  });
  await page.getByRole("button", { name: "Verify proof" }).click();
  await page.getByText(/internally consistent/).first().waitFor({ timeout: 10_000 });
  await page.getByRole("button", { name: "Download revival kit" }).click();
  await page.locator("#kit-download-status").getByText("REVIVAL.md downloaded").waitFor();
  await page.getByRole("button", { name: "Copy issue body" }).click();
  await page.locator("#kit-copy-status").getByText(/Issue body copied|Could not copy/).waitFor({ timeout: 10_000 });
  const results = await dump("home-results-used");
  check("home-results-used", /REVIVAL\.md downloaded/.test(results), "kit download status text is not in the accessibility tree");
  check("home-results-used", /internally consistent/.test(results), "verification status text is not in the accessibility tree");

  for (const [name, text, expected] of [
    ["proof-valid", proofText, "Valid"],
    ["proof-invalid", (() => { const t = JSON.parse(proofText); t.receipts[1].url = "https://evil.test/"; return JSON.stringify(t); })(), "Invalid"],
  ] as const) {
    await page.goto(base + "/proof", { waitUntil: "networkidle" });
    if (name === "proof-valid") await dump("proof-empty");
    await page.fill("#proof-paste", text);
    await page.getByRole("button", { name: "Verify pasted text" }).click();
    await page.locator("#proof-result").waitFor({ timeout: 10_000 });
    const tree = await dump(name);
    check(name, (await page.locator("#proof-result").innerText()).startsWith(expected), `verdict is not ${expected}`);
    check(name, tree.includes(expected), `verdict word "${expected}" missing from the accessibility tree`);
    const live = await page.locator("[role=status]").allInnerTexts();
    console.log(`${name}: status regions -> ${JSON.stringify(live.map((s) => s.slice(0, 100)))}`);
  }

} finally {
  await browser.close();
}
if (failures.length) {
  console.error("\nFAILURES:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("\nRESULT: accessibility-tree checks passed");
