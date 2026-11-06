import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const unzipAvailable = spawnSync("unzip", ["-v"]).status === 0;

function fromZip(name: string): Buffer {
  const result = spawnSync(
    "unzip",
    ["-p", join(root, "public/restoration-kit.zip"), name],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  expect(result.status, `${name} missing from kit`).toBe(0);
  return result.stdout;
}

describe.skipIf(!unzipAvailable)("committed restoration kit", () => {
  it("contains the same bytes as the current sources, so it cannot drift", () => {
    const files: Array<[string, string]> = [
      ["scripts/verify-restoration.mts", "scripts/verify-restoration.mts"],
      ["src/lib/restoration/reverse.mts", "src/lib/restoration/reverse.mts"],
      ["src/lib/restoration/fixtures.json", "src/lib/restoration/fixtures.json"],
      ["third_party/esrever/upstream/esrever.js", "third_party/esrever/upstream/esrever.js"],
      ["third_party/esrever/upstream/LICENSE-MIT.txt", "third_party/esrever/upstream/LICENSE-MIT.txt"],
      ["LICENSE-GRAVEKEEPER-MIT", "LICENSE"],
    ];
    for (const [inZip, onDisk] of files) {
      expect(fromZip(inZip).equals(readFileSync(join(root, onDisk))), inZip).toBe(true);
    }
  });
});
