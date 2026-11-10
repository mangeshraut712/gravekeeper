"use client";

import { useState } from "react";
import { verifyReceiptExport } from "@/lib/receipts/export";
import type { ReceiptExportV1 } from "@/lib/receipts/export";

const button = "min-h-11 rounded border border-stone-500 px-4 py-2 text-sm text-stone-100 hover:border-amber-200 disabled:opacity-50";

export default function LanternHillProof({ proof }: { proof: ReceiptExportV1 }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    setBusy(true);
    setStatus("Checking signatures, receipt links, and both HTML documents…");
    try {
      const result = await verifyReceiptExport(proof);
      setStatus(result.valid && result.artifacts?.before && result.artifacts?.after
        ? "Both HTML documents match their signed receipts. Internal consistency verified."
        : "Verification failed. The file may be changed or this browser may not support Ed25519.");
    } catch {
      setStatus("Verification is unavailable in this browser. Download the file and use the local verification API.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(new Blob([JSON.stringify(proof, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "gravekeeper-lantern-hill-receipts.json";
      document.body.append(link);
      link.click();
      link.remove();
      setStatus("Receipt file prepared. Check your browser downloads.");
    } catch {
      setStatus("Download could not be prepared. Try another browser.");
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  }

  return <section aria-labelledby="proof-title" className="mt-10 rounded-xl border border-stone-600 bg-[#171b16] p-5">
    <h2 id="proof-title" className="font-serif text-2xl">Keep the HTML receipts</h2>
    <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-300">Verification checks the receipt signatures and the exact before/after HTML bytes. It does not prove authorship, historical origin, or the truth of a claim. The signing key is generated for this page load; this is an original fixture, not recovered archive evidence.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" className={button} disabled={busy} onClick={verify}>{busy ? "Verifying…" : "Verify HTML receipts"}</button>
      <button type="button" className={button} onClick={download}>Download receipt file</button>
    </div>
    <p role="status" className="mt-3 text-sm text-amber-200">{status}</p>
    <ol className="mt-4 space-y-3 break-all text-xs text-stone-300">
      {proof.receipts.map((receipt) => <li key={receipt.seq}><span className="text-amber-200">{receipt.seq + 1}. {receipt.kind}</span><br />SHA-256: {receipt.contentSha256}</li>)}
    </ol>
  </section>;
}
