// Runs Lighthouse (mobile defaults, headless Chrome) against a running production build.
// Usage: npm run build && npx next start -p 3100 &  BASE_URL=http://localhost:3100 npm run lighthouse
// Optional: CHROME_PATH=/path/to/chrome, RUNS=3 (median of N per page; default 3), OUT=dir for the raw JSON reports.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const runs = Number(process.env.RUNS ?? 3);
const out = process.env.OUT;
if (out) mkdirSync(out, { recursive: true });
const pages = ["/", "/restoration", "/lantern-hill", "/proof"];
const cats = ["performance", "accessibility", "best-practices", "seo"] as const;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

console.log(`| Page | ${cats.join(" | ")} | LCP ms | TBT ms | CLS |`);
console.log(`|---|${cats.map(() => "---").join("|")}|---|---|---|`);
for (const path of pages) {
  const rows: Record<string, number[]> = { lcp: [], tbt: [], cls: [], ...Object.fromEntries(cats.map((c) => [c, []])) };
  for (let i = 0; i < runs; i++) {
    const file = `${out ?? "/tmp"}/lh-${path.replace(/\W+/g, "_") || "home"}-${i}.json`;
    execFileSync("npx", ["lighthouse", base + path, "--quiet", "--output=json", `--output-path=${file}`, "--chrome-flags=--headless=new --no-sandbox"], { stdio: ["ignore", "ignore", "inherit"] });
    const r = JSON.parse(readFileSync(file, "utf8"));
    for (const c of cats) rows[c].push(Math.round((r.categories[c].score ?? 0) * 100));
    rows.lcp.push(r.audits["largest-contentful-paint"].numericValue);
    rows.tbt.push(r.audits["total-blocking-time"].numericValue);
    rows.cls.push(r.audits["cumulative-layout-shift"].numericValue);
  }
  console.log(`| ${path} | ${cats.map((c) => median(rows[c])).join(" | ")} | ${Math.round(median(rows.lcp))} | ${Math.round(median(rows.tbt))} | ${median(rows.cls).toFixed(3)} |`);
}
