// Sweeps the fog animation phases instead of sampling a few wall-clock frames.
// Usage: BASE_URL=http://localhost:3000 node scripts/fog-sweep.mts   (PHASES=12 by default => 144 frames per viewport)
// Method: pause both fog layers, set each layer's animation time to every combination of N phases of its own
// cycle (48 s and 64 s), hide everything except the fog, screenshot the viewport and keep the brightest pixel.
// Reports the contrast of the lightest muted text colour in use (#a6a09b, stone-400) against that pixel.
// Limits: fog over the flat page colour only; content that paints its own glow is not included; Chromium only.
import { chromium } from "playwright";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const N = Number(process.env.PHASES ?? 12);
const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (p: number[]) => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
const hex = (p: number[]) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");
const text = [0xa6, 0xa0, 0x9b];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
let failed = false;
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "body *:not([data-testid=fog-overlay]):not([data-testid=fog-overlay] *){visibility:hidden!important}" });
  const count = await page.evaluate(() => {
    const a = document.getAnimations().filter((x) => (x as CSSAnimation).animationName?.startsWith("fog-drift"));
    a.forEach((x) => x.pause());
    return a.length;
  });
  if (count !== 2) throw new Error(`expected 2 fog animations, found ${count}`);
  let best = { l: -1, px: [0, 0, 0] };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    await page.evaluate(({ i, j, N }) => {
      const a = document.getAnimations().filter((x) => (x as CSSAnimation).animationName?.startsWith("fog-drift"))
        .sort((x, y) => (x as CSSAnimation).animationName.localeCompare((y as CSSAnimation).animationName));
      a[0].currentTime = (i / N) * 48000;
      a[1].currentTime = (j / N) * 64000;
    }, { i, j, N });
    const b64 = (await page.screenshot({ type: "png" })).toString("base64");
    const px = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      const x = c.getContext("2d", { willReadFrequently: true })!;
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const L = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      let m = -1, out = [0, 0, 0];
      for (let p = 0; p < d.length; p += 4) {
        const l = 0.2126 * L(d[p]) + 0.7152 * L(d[p + 1]) + 0.0722 * L(d[p + 2]);
        if (l > m) { m = l; out = [d[p], d[p + 1], d[p + 2]]; }
      }
      return out;
    }, b64);
    if (lum(px) > best.l) best = { l: lum(px), px };
  }
  const r = (lum(text) + 0.05) / (best.l + 0.05);
  console.log(`${viewport.width}x${viewport.height}: ${N * N} phase pairs, brightest fog pixel ${hex(best.px)}, #a6a09b on it ${r.toFixed(2)}:1 ${r >= 4.5 ? "OK" : "BELOW 4.5"}`);
  if (r < 4.5) failed = true;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
