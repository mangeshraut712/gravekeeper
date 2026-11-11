// Runs Lighthouse 12 (via npx) against a running production build for each page in
// mobile (Lighthouse default) and desktop (--preset=desktop), RUNS times each, and
// prints a Markdown table of the median run (by performance score, then TBT).
// Usage: BASE_URL=http://localhost:3417 OUT_DIR=/tmp/lh RUNS=3 node scripts/lighthouse-run.mjs
// Uses CHROME_PATH if set; otherwise Lighthouse finds an installed Chrome.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const base = process.env.BASE_URL ?? "http://localhost:3417";
const outDir = process.env.OUT_DIR ?? "/tmp/lighthouse";
const runs = Number(process.env.RUNS ?? 3);
const pages = ["/", "/restoration", "/lantern-hill"];
const modes = ["mobile", "desktop"];
mkdirSync(outDir, { recursive: true });

// Warm the server so the first measured run does not pay for cold start.
for (const page of pages) await fetch(`${base}${page}`).then((r) => r.text());

const rows = [];
for (const page of pages) {
  for (const mode of modes) {
    const reports = [];
    for (let run = 1; run <= runs; run++) {
      const file = join(outDir, `${page === "/" ? "home" : page.slice(1)}-${mode}-${run}.json`);
      const args = [
        "-y", "lighthouse@12", `${base}${page}`,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--output=json", `--output-path=${file}`, "--quiet",
        "--chrome-flags=--headless=new",
      ];
      if (mode === "desktop") args.push("--preset=desktop");
      execFileSync("npx", args, { stdio: ["ignore", "ignore", "inherit"] });
      reports.push(JSON.parse(readFileSync(file, "utf8")));
    }
    const tbt = (r) => r.audits["total-blocking-time"].numericValue;
    const perf = (r) => r.categories.performance.score;
    reports.sort((a, b) => perf(a) - perf(b) || tbt(b) - tbt(a));
    const median = reports[Math.floor(reports.length / 2)];
    const score = (id) => Math.round(median.categories[id].score * 100);
    const audit = (id) => median.audits[id].displayValue ?? "n/a";
    const perfRange = reports.map((r) => Math.round(perf(r) * 100)).join("/");
    const tbtRange = reports.map((r) => Math.round(tbt(r))).join("/");
    rows.push(
      `| ${page} | ${mode} | ${score("performance")} | ${score("accessibility")} | ${score("best-practices")} | ${score("seo")} | ${audit("largest-contentful-paint")} | ${audit("cumulative-layout-shift")} | ${audit("total-blocking-time")} | ${audit("first-contentful-paint")} | ${perfRange} | ${tbtRange} |`,
    );
    const failing = Object.values(median.audits)
      .filter((a) => a.score !== null && a.score < 0.9 && !["informative", "notApplicable", "manual"].includes(a.scoreDisplayMode))
      .map((a) => `${a.id}${a.displayValue ? ` (${a.displayValue})` : ""}`);
    console.error(`${page} ${mode} audits below 0.9 (median run): ${failing.join(", ") || "none"}`);
  }
}
console.log("| Page | Mode | Perf | A11y | Best practices | SEO | LCP | CLS | TBT | FCP | Perf (all runs) | TBT ms (all runs) |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const row of rows) console.log(row);
