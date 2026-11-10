/** Offline, dependency-free before/after check. Node.js 22.18+ required. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { reverse } from "../src/lib/restoration/reverse.mts";

const commit = "14b34013dad49106ca08c0e65919f1fc8fea5331";
const sourceBlob = "0df77a567a8571656165c12d02acb3f92592473c";
const licenseBlob = "a41e0a7ef970ecdd83d82cd99bda97b22077bc62";
const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const gitBlob = (bytes: Buffer) => createHash("sha1")
  .update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

type Fixture = { id: string; label: string; input: string; expected: string };

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--json" && arg !== "--baseline")) {
    console.error("Usage: node scripts/verify-restoration.mts [--json] [--baseline]");
    process.exitCode = 2;
  } else {
    const source = read("third_party/esrever/upstream/esrever.js");
    const license = read("third_party/esrever/upstream/LICENSE-MIT.txt");
    if (gitBlob(source) !== sourceBlob) throw new Error("Upstream source does not match the pinned Git blob; refusing to execute.");
    if (gitBlob(license) !== licenseBlob) throw new Error("Upstream MIT license does not match the pinned Git blob.");
    // Only load this reviewed, pinned local file after its bytes match.
    const require = createRequire(import.meta.url);
    const original = require(fileURLToPath(new URL("third_party/esrever/upstream/esrever.js", root))) as { reverse: (s: string) => string };
    const fixtureBytes = read("src/lib/restoration/fixtures.json");
    const fixtures: Fixture[] = JSON.parse(fixtureBytes.toString("utf8"));
    const results = fixtures.map((fixture) => {
      const before = original.reverse(fixture.input);
      const after = reverse(fixture.input);
      return { ...fixture, before, after, beforePassed: before === fixture.expected, afterPassed: after === fixture.expected };
    });
    const summary = {
      total: results.length,
      beforePassed: results.filter((r) => r.beforePassed).length,
      afterPassed: results.filter((r) => r.afterPassed).length,
      improvements: results.filter((r) => !r.beforePassed && r.afterPassed).length,
    };
    const report = {
      format: "gravekeeper-restoration-v1",
      source: {
        repository: "https://github.com/mathiasbynens/esrever", commit,
        path: "esrever.js", gitBlobSha1: sourceBlob, sha256: sha256(source),
        url: `https://github.com/mathiasbynens/esrever/blob/${commit}/esrever.js`,
        license: "MIT", licenseGitBlobSha1: licenseBlob,
        status: "Dormant default branch; not marked archived by GitHub when checked on 2026-11-06.",
      },
      runtime: { node: process.version, icu: process.versions.icu, unicode: process.versions.unicode },
      fingerprints: {
        restoredSha256: sha256(read("src/lib/restoration/reverse.mts")),
        fixturesSha256: sha256(fixtureBytes),
        verifierSha256: sha256(read("scripts/verify-restoration.mts")),
      },
      summary, results,
      scope: "A curated modernization of the reverse API, not a full package revival or automated arbitrary-repository repair. Counts describe these fixtures only.",
      trust: "Reproducible local execution, not a signed attestation. Compare pinned upstream bytes with GitHub independently. A report alone does not prove it was executed honestly.",
    };
    if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else {
      console.log(`Pinned esrever source: ${sourceBlob} (matches)`);
      console.log(`Before: ${summary.beforePassed}/${summary.total} | After: ${summary.afterPassed}/${summary.total} | Improvements: ${summary.improvements}`);
      for (const result of results) console.log(`${result.beforePassed ? "PASS" : "FAIL"} -> ${result.afterPassed ? "PASS" : "FAIL"}  ${result.label}`);
      console.log(report.scope);
    }
    const passed = args.includes("--baseline")
      ? summary.beforePassed === summary.total
      : summary.afterPassed === summary.total && summary.improvements > 0;
    process.exitCode = passed ? 0 : 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Restoration verification failed.");
  process.exitCode = 1;
}
