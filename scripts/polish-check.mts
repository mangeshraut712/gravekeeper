// UI polish check against a running production build (Playwright Chromium).
// Usage: BASE_URL=http://localhost:3417 node scripts/polish-check.mts [--shots]
//   CHROMIUM_PATH  optional Chromium/Chrome executable (defaults to Playwright's own)
// For 375x812 and 1440x900 it checks, and exits 1 if any check fails:
//   - no horizontal scroll on /, /restoration and /lantern-hill
//   - every element reached by Tab shows a visible focus indicator (outline or box-shadow)
//   - layout shift after a lookup result arrives (sum of layout-shift entry values)
// /api/resurrect is mocked with a SYNTHETIC signed response (scripts/synthetic-lookup.mts),
// delayed so the loading state is observable. --shots writes JPEGs to docs/screenshots/polish/.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import type { Page } from "playwright";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const shots = process.argv.includes("--shots");
const out = new URL("../docs/screenshots/polish/", import.meta.url).pathname;
if (shots) await mkdir(out, { recursive: true });
const mocked = JSON.stringify(await buildSyntheticLookup());
const viewports = [
  { name: "375", width: 375, height: 812 },
  { name: "1440", width: 1440, height: 900 },
];
const failures: string[] = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function shot(page: Page, name: string) {
  if (!shots) return;
  // Wait for finite animations, capped: infinite ones (fog, pulse) never finish.
  await Promise.race([
    page.evaluate(() => Promise.all(document.getAnimations()
      .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number))
      .map((a) => a.finished.catch(() => undefined)))),
    page.waitForTimeout(2000),
  ]);
  await page.screenshot({ path: `${out}${name}.jpg`, type: "jpeg", quality: 72 });
  console.log("  wrote", `${name}.jpg`);
}

async function overflow(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > width + 1 && getComputedStyle(el).position !== "fixed")
      .filter((el) => !el.closest("[aria-hidden='true']"))
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
    return { width, scroll, wide };
  });
}

async function focusAudit(page: Page) {
  const missing: string[] = [];
  let count = 0;
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    // PreviewFrame sets its ring after the window blur event or its 150 ms poll; give it time.
    await page.waitForTimeout(200);
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const shadow = style.boxShadow !== "none";
      const name = el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.id || "";
      const label = `${el.tagName.toLowerCase()}:${name.trim().slice(0, 40)}`;
      const r = el.getBoundingClientRect();
      return { label, visible: outline || shadow, size: `${Math.round(r.width)}x${Math.round(r.height)}`, iframe: el.tagName === "IFRAME" };
    });
    if (process.env.DEBUG) console.log("    tab", i, info?.label, info?.visible);
    if (!info) break;
    // Tab moves through the links inside a preview iframe; the parent's activeElement stays the iframe.
    if (seen.has(info.label) && !info.iframe) break;
    if (seen.has(info.label)) continue;
    seen.add(info.label);
    count++;
    if (!info.visible) missing.push(`${info.label} (${info.size})`);
  }
  return { count, missing };
}

for (const vp of viewports) {
  console.log(`viewport ${vp.width}x${vp.height}`);
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  for (const path of ["/", "/restoration", "/lantern-hill"]) {
    const page = await ctx.newPage();
    await page.goto(base + path, { waitUntil: "networkidle" });
    const o = await overflow(page);
    const ok = o.scroll <= o.width;
    console.log(`  ${path} scrollWidth=${o.scroll} clientWidth=${o.width} ${ok ? "ok" : "HORIZONTAL SCROLL"} ${o.wide.join(" ")}`);
    if (!ok) failures.push(`${vp.name} ${path}: horizontal scroll (${o.scroll} > ${o.width})`);
    const f = await focusAudit(page);
    console.log(`  ${path} focus: ${f.count} tab stops, ${f.missing.length} without visible indicator ${f.missing.join(", ")}`);
    for (const m of f.missing) failures.push(`${vp.name} ${path}: no visible focus on ${m}`);
    await page.goto(base + path, { waitUntil: "networkidle" });
    await shot(page, `${path === "/" ? "home" : path.slice(1)}-${vp.name}`);
    await page.close();
  }

  // Lookup flow: empty -> loading -> results; measure layout shift after the result arrives.
  const page = await ctx.newPage();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/resurrect", async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: "application/json", body: mocked });
  });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.locator("#lookup").scrollIntoViewIfNeeded();
  await page.locator("#resource-url").fill(syntheticRepoUrl);
  await page.getByRole("button", { name: /unearth project/i }).click();
  await page.getByText("Listening for signs of life").waitFor();
  await shot(page, `lookup-loading-${vp.name}`);
  await page.evaluate(() => {
    const w = window as unknown as { __shifts: { value: number; sources: string[] }[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; sources?: { node?: Node }[] }[]) {
        w.__shifts.push({
          value: e.value,
          sources: (e.sources ?? []).map((s) => (s.node instanceof Element ? `${s.node.tagName.toLowerCase()}.${String(s.node.className).slice(0, 30)}` : "?")),
        });
      }
    }).observe({ type: "layout-shift", buffered: false });
  });
  release();
  await page.getByText("Lookup complete").waitFor();
  await page.waitForTimeout(1500);
  const shifts = await page.evaluate(() => (window as unknown as { __shifts: { value: number; sources: string[] }[] }).__shifts);
  const total = shifts.reduce((sum, s) => sum + s.value, 0);
  console.log(`  layout shift after results: ${total.toFixed(4)} over ${shifts.length} entries ${shifts.map((s) => `${s.value.toFixed(4)}[${s.sources.join(",")}]`).join(" ")}`);
  if (total >= 0.1) failures.push(`${vp.name}: layout shift ${total.toFixed(3)} after results`);
  const o = await overflow(page);
  if (o.scroll > o.width) failures.push(`${vp.name} / with results: horizontal scroll (${o.scroll} > ${o.width}) ${o.wide.join(" ")}`);
  console.log(`  / with results scrollWidth=${o.scroll} clientWidth=${o.width}`);
  // Focus starts on the results heading; tab through every control in the results.
  const rf = await focusAudit(page);
  console.log(`  / with results focus: ${rf.count} tab stops, ${rf.missing.length} without visible indicator ${rf.missing.join(", ")}`);
  for (const m of rf.missing) failures.push(`${vp.name} / with results: no visible focus on ${m}`);
  await page.getByRole("heading", { name: "The excavation" }).scrollIntoViewIfNeeded();
  await shot(page, `lookup-results-${vp.name}`);
  await page.close();

  // Error state.
  const err = await ctx.newPage();
  await err.route("**/api/resurrect", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "The archive service did not respond. Please try again.", code: "HTTP_ERROR" }) }));
  await err.goto(base + "/", { waitUntil: "networkidle" });
  await err.locator("#lookup").scrollIntoViewIfNeeded();
  await err.locator("#resource-url").fill(syntheticRepoUrl);
  await err.getByRole("button", { name: /unearth project/i }).click();
  await err.getByText("The archive service did not respond").first().waitFor();
  await shot(err, `lookup-error-${vp.name}`);
  await err.close();
  await ctx.close();
}
await browser.close();
if (failures.length) {
  console.error(`FAIL ${failures.length}:\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log("polish check passed");
