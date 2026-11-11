// Browser smoke for /proof: real download from /lantern-hill, then file input, tamper, paste, drop and keyboard focus.
// Usage: BASE_URL=http://localhost:3000 node scripts/proof-smoke.mts
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await (await browser.newContext()).newPage();
const requests: string[] = [];
page.on("request", (r) => requests.push(`${r.method()} ${new URL(r.url()).pathname}`));
let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed++;
};
const result = () => page.locator("#proof-result").innerText({ timeout: 5000 });

await page.goto(base + "/lantern-hill", { waitUntil: "networkidle" });
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download receipt file" }).click()]);
const dir = mkdtempSync(join(tmpdir(), "proof-"));
const good = join(dir, "good.json");
await download.saveAs(good);

await page.goto(base + "/proof", { waitUntil: "networkidle" });
check("empty state, no verdict", (await page.getByText("No proof checked yet").count()) === 1 && (await page.locator("#proof-result").count()) === 0);
requests.length = 0;

await page.setInputFiles("#proof-file", good);
check("downloaded file verifies as valid", (await result()).startsWith("Valid"));
check("receipts listed", (await page.getByText("1. fixture").count()) === 1);

const proof = JSON.parse(readFileSync(good, "utf8"));
proof.receipts[1].url = "https://evil.test/";
const bad = join(dir, "bad.json");
writeFileSync(bad, JSON.stringify(proof));
await page.setInputFiles("#proof-file", bad);
check("tampered file is invalid", (await result()).startsWith("Invalid"));

const junk = join(dir, "junk.json");
writeFileSync(junk, "{nope");
await page.setInputFiles("#proof-file", junk);
await page.getByText("Could not read this proof").waitFor();
check("unreadable JSON shows error, no verdict", (await page.locator("#proof-result").count()) === 0);

await page.fill("#proof-paste", readFileSync(good, "utf8"));
await page.getByRole("button", { name: "Verify pasted text" }).click();
check("pasted file verifies", (await result()).startsWith("Valid"));

await page.goto(base + "/proof", { waitUntil: "networkidle" }); // fresh page so the previous verdict cannot satisfy the wait
await page.evaluate((text) => {
  const dt = new DataTransfer();
  dt.items.add(new File([text.replace('"kind": "fixture"', '"kind": "fixture "')], "dropped.json", { type: "application/json" }));
  const zone = document.querySelector("label[for=proof-file]")!;
  zone.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
}, readFileSync(good, "utf8"));
await page.getByRole("heading", { name: /Invalid|Valid/ }).waitFor();
check("synthetic drop event is verified (edited kind => invalid)", (await result()).startsWith("Invalid"));

await page.goto(base + "/proof", { waitUntil: "networkidle" });
const focused: string[] = [];
for (let i = 0; i < 4; i++) {
  await page.keyboard.press("Tab");
  focused.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || ""));
}
check(`keyboard reaches file input and paste box (${focused.join(", ")})`, focused.includes("proof-file") && focused.includes("proof-paste"));

const uploads = requests.filter((r) => r.startsWith("POST"));
check(`no POST requests during verification (${uploads.length})`, uploads.length === 0);
await browser.close();
process.exit(failed ? 1 : 0);
