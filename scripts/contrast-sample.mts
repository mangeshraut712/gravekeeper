// Pixel-sampled contrast check for text that axe marks "needs review" (text over the fog/glow layers).
// Usage: BASE_URL=http://localhost:3000 node scripts/contrast-sample.mts [--lookup]
// Method: for each state, (1) record the computed colour of every visible text element, (2) make all text,
// borders, shadows and component backgrounds transparent so only the page backdrop and fog remain,
// (3) screenshot the page three times 1.5 s apart (the fog drifts) and find the brightest backdrop pixel,
// Buttons are excluded (they paint their own background; text on them is not fog-backed). (4) report the contrast of each distinct text colour against that pixel (alpha blended over it).
// The brightest pixel is a worst case: the real backdrop under most text is darker. It is a measurement of
// the sampled frames only, not every animation phase. --lookup adds a live atom/atom results state (network).
// --panels adds a SYNTHETIC signed lookup (scripts/synthetic-lookup.mts) and samples only text inside the
// Epitaph, Dependency autopsy and Revival kit panels, with every disclosure open and the kit buttons pressed.
// Those panels paint an opaque background over the fog, so in that mode component backgrounds are KEPT
// (only text, borders and shadows are made transparent) and buttons are included: the backdrop sampled is
// what is really behind each text box, with the fog still animating underneath.
import { chromium } from "playwright";
import { buildSyntheticLookup, syntheticRepoUrl } from "./synthetic-lookup.mts";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const withLookup = process.argv.includes("--lookup");
const withPanels = process.argv.includes("--panels");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

type Item = { tag: string; text: string; color: [number, number, number, number]; x: number; y: number; w: number; h: number };
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

// Every visible text element: computed colour + page-space box of its own text.
type Opts = { scope?: string; keepBackgrounds?: boolean };
async function textItems(page: import("playwright").Page, opts: Opts = {}): Promise<Item[]> {
  return page.evaluate(({ scope, keep }) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const out: Item[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (scope && !el.closest(scope)) continue;
      if (el.closest(keep ? "[aria-hidden='true']" : "[aria-hidden='true'], button")) continue; // buttons paint their own background
      const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!nodes.length) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const range = document.createRange();
      for (const n of nodes) {
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = cs.color;
          ctx.fillRect(0, 0, 1, 1);
          const d = ctx.getImageData(0, 0, 1, 1).data;
          out.push({ tag: el.tagName.toLowerCase(), text: (n.textContent ?? "").trim().slice(0, 28), color: [d[0], d[1], d[2], d[3] / 255], x: Math.floor(r.left + scrollX), y: Math.floor(r.top + scrollY), w: Math.ceil(r.width), h: Math.ceil(r.height) });
        }
      }
    }
    return out;
  }, { scope: opts.scope ?? "", keep: !!opts.keepBackgrounds });
}

// Brightest backdrop pixel inside each text box, over 3 frames (the fog drifts).
async function backdrops(page: import("playwright").Page, items: Item[], keepBackgrounds = false): Promise<[number, number, number][]> {
  const hideText = `*,*::before,*::after{color:transparent!important;border-color:transparent!important;text-shadow:none!important;box-shadow:none!important;outline:none!important;caret-color:transparent!important;text-decoration:none!important;text-decoration-color:transparent!important;-webkit-text-fill-color:transparent!important}
::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}`;
  await page.addStyleTag({
    content: keepBackgrounds
      ? `${hideText}\nsvg{visibility:hidden!important}`
      : `${hideText}\nbody *:not(svg):not(path){background:transparent!important;filter:none!important}\nsvg,button{visibility:hidden!important}`,
  });
  const best: [number, number, number][] = items.map(() => [0, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const png = (await page.screenshot({ fullPage: true, type: "png" })).toString("base64");
    const px = await page.evaluate(async ({ b64, boxes }) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const L = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return boxes.map((b) => {
        const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y);
        const w = Math.min(b.w, c.width - x0), h = Math.min(b.h, c.height - y0);
        const d = x.getImageData(x0, y0, Math.max(1, w), Math.max(1, h)).data;
        let m = -1, out = [0, 0, 0];
        for (let p = 0; p < d.length; p += 4) {
          const l = 0.2126 * L(d[p]) + 0.7152 * L(d[p + 1]) + 0.0722 * L(d[p + 2]);
          if (l > m) { m = l; out = [d[p], d[p + 1], d[p + 2]]; }
        }
        return out;
      });
    }, { b64: png, boxes: items });
    px.forEach((p, k) => { if (lum(p[0], p[1], p[2]) > lum(...best[k])) best[k] = p as [number, number, number]; });
    await page.waitForTimeout(1500);
  }
  return best;
}

async function measure(name: string, drive: (page: import("playwright").Page) => Promise<void>, opts: Opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await ctx.newPage();
  await drive(page);
  await page.evaluate(() => Promise.race([Promise.all(document.getAnimations().filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime as number)).map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 2000))]));
  const items = await textItems(page, opts);
  if (!items.length) throw new Error(`${name}: no text boxes found${opts.scope ? ` inside ${opts.scope}` : ""}`);
  const bgs = await backdrops(page, items, opts.keepBackgrounds);
  let worst = { r: Infinity, i: 0 };
  let maxBg = 0;
  let fail = 0;
  const failing: string[] = [];
  const bright: string[] = [];
  items.forEach((it, i) => {
    const [r, g, b, a] = it.color;
    const bg = bgs[i];
    const mix = [r, g, b].map((v, k) => Math.round(v * a + bg[k] * (1 - a))) as [number, number, number];
    const rr = ratio(lum(...mix), lum(...bg));
    maxBg = Math.max(maxBg, lum(...bg));
    if (lum(...bg) > 0.1 && !opts.keepBackgrounds) bright.push(`    note: backdrop ${hex(...bg)} under ${hex(r, g, b)} ${rr.toFixed(2)}:1 <${it.tag}> "${it.text}" (element paints its own background)`);
    if (rr < worst.r) worst = { r: rr, i };
    if (rr < 4.5) { fail++; failing.push(`    ${hex(r, g, b)}${a < 1 ? `@${a.toFixed(2)}` : ""} on ${hex(...bg)} ${rr.toFixed(2)}:1 <${it.tag}> "${it.text}"`); }
  });
  const w = items[worst.i];
  console.log(`${name}: ${items.length} text boxes; brightest backdrop under any text ${hex(...bgs.reduce((m, p) => (lum(...p) > lum(...m) ? p : m)))}; lowest ratio ${worst.r.toFixed(2)}:1 (${hex(w.color[0], w.color[1], w.color[2])} on ${hex(...bgs[worst.i])}, <${w.tag}> "${w.text}"); boxes below 4.5:1: ${fail}`);
  if (process.env.CONTRAST_LIST) items.forEach((it, i) => console.log(`    ${hex(it.color[0], it.color[1], it.color[2])} on ${hex(...bgs[i])} <${it.tag}> "${it.text}"`));
  for (const f of failing.slice(0, 8)) console.log(f);
  for (const f of bright.slice(0, 4)) console.log(f);
  await page.context().close();
}

const goHome = async (page: import("playwright").Page): Promise<void> => { await page.goto(base + "/", { waitUntil: "networkidle" }); };
await measure("initial", goHome);
await measure("invalid URL error", async (page) => {
  await goHome(page);
  await page.fill("#resource-url", "not a url");
  await page.click("button[type=submit]");
  await page.locator("#lookup-error").getByText("Enter a public HTTP(S) URL").waitFor();
});
await measure("server error (mocked 404)", async (page) => {
  await page.route("**/api/resurrect", (r) => r.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Repository not found or not public." }) }));
  await goHome(page);
  await page.fill("#resource-url", "https://github.com/example/missing");
  await page.click("button[type=submit]");
  await page.locator("#lookup-error").getByText("Repository not found").waitFor();
});
await measure("running (Cancel visible)", async (page) => {
  await page.route("**/api/resurrect", () => new Promise<void>(() => {}));
  await goHome(page);
  await page.fill("#resource-url", "https://github.com/example/slow");
  await page.click("button[type=submit]");
  await page.getByRole("button", { name: "Cancel" }).waitFor();
});
await measure("canceled", async (page) => {
  await page.route("**/api/resurrect", () => new Promise<void>(() => {}));
  await goHome(page);
  await page.fill("#resource-url", "https://github.com/example/slow");
  await page.click("button[type=submit]");
  await page.getByRole("button", { name: "Cancel" }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator("#lookup-error").getByText("Lookup canceled").waitFor();
});
if (withLookup) {
  await measure("live atom/atom results (receipts open)", async (page) => {
    await goHome(page);
    await page.fill("#resource-url", "https://github.com/atom/atom");
    await page.click("button[type=submit]");
    await page.getByText("Lookup complete").waitFor({ timeout: 45_000 });
    await page.locator("section[aria-labelledby='proof-title'] details").evaluateAll((n) => { for (const x of n) (x as HTMLDetailsElement).open = true; });
  });
}
if (withPanels) {
  const synthetic = await buildSyntheticLookup();
  const panels: [string, string][] = [
    ["Epitaph", "section[aria-labelledby='epitaph-title']"],
    ["Dependency autopsy", "section[aria-labelledby='autopsy-title']"],
    ["Revival kit", "section[aria-labelledby='kit-title']"],
  ];
  for (const [label, scope] of panels) {
    await measure(`synthetic lookup, ${label} panel (disclosures open, kit used; own backgrounds kept)`, async (page) => {
      await page.route("**/api/resurrect", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(synthetic) }));
      await goHome(page);
      await page.fill("#resource-url", syntheticRepoUrl);
      await page.click("button[type=submit]");
      await page.getByText("Lookup complete").waitFor({ timeout: 15_000 });
      await page.locator("details").evaluateAll((n) => { for (const x of n) (x as HTMLDetailsElement).open = true; });
      await page.getByText("Months with a capture").waitFor({ state: "visible" });
      await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download revival kit" }).click()]);
      await page.locator("#kit-download-status").getByText("REVIVAL.md downloaded").waitFor();
      await page.getByRole("button", { name: "Copy issue body" }).click();
      await page.locator("#kit-copy-status").getByText(/Issue body copied|Could not copy/).waitFor({ timeout: 10_000 });
      await page.mouse.move(0, 0); // no hover colour on the last button
    }, { scope, keepBackgrounds: true });
  }
}
await browser.close();
