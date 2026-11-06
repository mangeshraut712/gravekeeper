/** Offline verifier. Node.js 22.18+; no network, packages, or server needed. */
import { readFile } from "node:fs/promises";
import { verifyProof } from "../src/client/proof.ts";

const file = process.argv[2];
if (!file) {
  console.error(
    "Usage: node scripts/verify-proof.ts path/to/gravekeeper-proof.json",
  );
  process.exitCode = 2;
} else {
  try {
    const proof = JSON.parse(await readFile(file, "utf8"));
    if (
      proof.format !== "gravekeeper-proof-v1" ||
      typeof proof.resource !== "string" ||
      !(await verifyProof(proof, proof.resource))
    ) {
      console.error(
        "INVALID: receipt signatures, links, evidence, or displayed data do not match.",
      );
      process.exitCode = 1;
    } else {
      console.log(
        `Internally consistent: ${proof.receipts.length} receipts and their evidence verified.`,
      );
      console.log(
        "This checks integrity under the included key, not source truth, authorship, or completeness.",
      );
    }
  } catch {
    console.error(
      "INVALID: file is unreadable, malformed, or unsupported by this Node version.",
    );
    process.exitCode = 1;
  }
}
