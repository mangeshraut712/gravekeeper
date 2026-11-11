"use client";

import { useState } from "react";
import type { ResurrectResponse } from "@/types";
import { exportProof, verifyProof } from "@/client/proof";
import { button } from "./styles";

type Verification = "idle" | "running" | "valid" | "invalid";

/** Two polite live regions: verification result and download failure, so one never hides the other. */
export function ProofStatus({
  verification,
  downloadError,
}: {
  verification: Verification;
  downloadError: string;
}) {
  return (
    <>
      <p
        role="status"
        className={`mb-3 text-sm ${verification === "valid" ? "text-lime-200" : "text-amber-200"}`}
      >
        {verification === "valid"
          ? "Proof internally consistent: signatures, links, and included data match."
          : verification === "invalid"
            ? "Verification failed or this browser does not support Ed25519. Try the offline verifier."
            : ""}
      </p>
      <p role="status" className="mb-3 text-sm text-amber-200">
        {downloadError}
      </p>
    </>
  );
}

export function ReceiptChainViewer({ result, url }: { result: ResurrectResponse; url: string }) {
  const [verification, setVerification] = useState<Verification>("idle");
  const [downloadError, setDownloadError] = useState("");
  async function verify() {
    setVerification("running");
    setVerification((await verifyProof(result, url)) ? "valid" : "invalid");
  }
  function download() {
    setDownloadError("");
    try {
      const href = URL.createObjectURL(
        new Blob([exportProof(result, url)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = "gravekeeper-proof.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setDownloadError("Download could not start. Please try again.");
    }
  }
  return (
    <section
      aria-labelledby="proof-title"
      className="rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="proof-title" className="font-serif text-2xl">
          Leave a paper trail
        </h3>
        <span className="rounded-full border border-stone-600 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300">
          Ed25519 + SHA-256
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-400">
        {result.receipts.length} linked receipts record this lookup. Verify
        their signatures in your browser, then keep an export for later.
      </p>
      <div className="my-5 flex flex-wrap gap-3">
        <button
          className={button}
          type="button"
          disabled={verification === "running"}
          onClick={verify}
        >
          {verification === "running" ? "Verifying…" : "Verify proof"}
        </button>
        <button className={button} type="button" onClick={download}>
          Download proof <span aria-hidden="true">↓</span>
        </button>
      </div>
      <ProofStatus verification={verification} downloadError={downloadError} />
      <div className="divide-y divide-stone-700/60">
        {result.receipts.map((receipt) => (
          <details key={receipt.seq} className="py-3">
            <summary className="cursor-pointer text-sm text-stone-200">
              <span className="mr-3 font-mono text-xs text-stone-400">
                {String(receipt.seq + 1).padStart(2, "0")}
              </span>
              {receipt.kind}
              <span className="ml-3 font-mono text-[10px] text-stone-400">
                {receipt.hash.slice(0, 12)}…
              </span>
            </summary>
            <dl className="mt-3 space-y-2 break-all pl-7 text-xs leading-5 text-stone-400">
              <div>
                <dt className="text-stone-200">Resource</dt>
                <dd>{receipt.url}</dd>
              </div>
              <div>
                <dt className="text-stone-200">Recorded at</dt>
                <dd>{receipt.fetchedAt}</dd>
              </div>
              <div>
                <dt className="text-stone-200">Receipt hash</dt>
                <dd className="font-mono">{receipt.hash}</dd>
              </div>
              <div>
                <dt className="text-stone-200">Content digest</dt>
                <dd className="font-mono">{receipt.contentSha256}</dd>
              </div>
            </dl>
          </details>
        ))}
      </div>
      <p className="mt-4 border-t border-stone-700/60 pt-4 text-xs leading-5 text-stone-400">
        Integrity, not proof of authorship or source truth. Each lookup uses a
        fresh signing key included in the export. An exported chain cannot
        authenticate GitHub or the Internet Archive, or prove that later
        receipts were not removed.
      </p>
    </section>
  );
}
