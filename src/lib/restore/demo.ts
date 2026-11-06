/** A local, curated demonstration. No arbitrary HTML or upstream URLs are accepted. */
import { buildReceipt } from "../receipts/chain";
import { exportPublicKey, generateKeyPair } from "../receipts/crypto";
import { buildReceiptExport } from "../receipts/export";
import { loadLanternHill } from "./fixture";
import { restoreDeadHtml } from "./html";

export async function buildLanternHillDemo() {
  const fixture = loadLanternHill();
  const restored = restoreDeadHtml(fixture.beforeHtml, { fixtureLabel: "Lantern Hill" });
  const { privateKey, publicKey } = await generateKeyPair();
  const encode = (value: string) => new TextEncoder().encode(value);
  const before = await buildReceipt(null, "fixture", fixture.url, encode(fixture.beforeHtml), privateKey);
  const after = await buildReceipt(before, "restoration", `${fixture.url}#restored`, encode(restored.html), privateKey);
  return {
    disclosure: fixture.disclosure,
    changes: restored.changes,
    proof: buildReceiptExport({
      publicKey: await exportPublicKey(publicKey),
      receipts: [before, after],
      beforeHtml: fixture.beforeHtml,
      afterHtml: restored.html,
    }),
  };
}
