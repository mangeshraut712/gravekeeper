"use client";

import { useState } from "react";
import type { DragEvent } from "react";
import { analyzeProofText, MAX_PROOF_BYTES } from "@/app/proof/analyze";
import type { ProofReport } from "@/app/proof/analyze";
import { primary } from "./styles";

export function ProofLimits() {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6 text-stone-300">
      <li>Valid means the file is consistent with itself: signatures, hash links and payload digests agree.</li>
      <li>It does not prove who made the file, or that GitHub or the Internet Archive said what the file records.</li>
      <li>The public key is inside the file. Someone who replaces the whole file and key, or cuts off the end of a valid chain, cannot be detected without a trusted copy kept elsewhere.</li>
    </ul>
  );
}

export function ProofResult({ report }: { report: ProofReport | null }) {
  if (!report) {
    return (
      <p className="mt-6 rounded-md border border-stone-600 p-4 text-sm text-stone-300">
        No proof checked yet. Nothing here is verified until you choose a file or paste one.
      </p>
    );
  }
  if (report.status === "error") {
    return (
      <div className="mt-6 rounded-md border border-red-300 p-4 text-sm text-red-200">
        <h2 className="font-serif text-xl">Could not read this proof</h2>
        <p className="mt-2">{report.message}</p>
      </div>
    );
  }
  const valid = report.status === "valid";
  return (
    <section aria-labelledby="proof-result" className="mt-6 rounded-md border border-stone-600 p-4">
      <h2 id="proof-result" className={`font-serif text-2xl ${valid ? "text-amber-200" : "text-red-200"}`}>
        {valid ? "Valid: internally consistent" : "Invalid: verification failed"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-200">{report.message}</p>
      <p className="mt-1 text-xs text-stone-300">Format: {report.format}</p>
      <h3 className="mt-4 font-serif text-lg">Receipts as written in the file</h3>
      {report.receipts.length ? (
        <ol className="mt-2 space-y-3 break-all text-xs text-stone-300">
          {report.receipts.map((r, i) => (
            <li key={i}>
              <span className="text-amber-200">
                {r.seq + 1}. {r.kind || "(no kind)"}
              </span>
              <br />
              URL: {r.url || "(missing)"}
              <br />
              Fetched: {r.fetchedAt || "(missing)"}
              <br />
              Hash: {r.hash || "(missing)"}
              <br />
              Payload SHA-256: {r.contentSha256 || "(missing)"}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-sm text-stone-300">No readable receipts.</p>
      )}
    </section>
  );
}

export default function ProofWorkbench() {
  const [report, setReport] = useState<ProofReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [announce, setAnnounce] = useState("");

  async function check(text: string) {
    setBusy(true);
    setAnnounce("Checking proof…");
    try {
      const next = await analyzeProofText(text);
      setReport(next);
      setAnnounce(
        next.status === "error"
          ? `Could not read the proof. ${next.message}`
          : next.status === "valid"
            ? "Valid. The proof is internally consistent."
            : "Invalid. Verification failed.",
      );
    } catch {
      setReport({ status: "error", code: "invalid-json", message: "Verification is unavailable in this browser." });
      setAnnounce("Verification is unavailable in this browser.");
    } finally {
      setBusy(false);
    }
  }

  async function checkFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PROOF_BYTES) {
      setReport({ status: "error", code: "too-large", message: "This file is larger than 5 MB. Gravekeeper proofs are much smaller." });
      setAnnounce("Could not read the proof. The file is larger than 5 MB.");
      return;
    }
    try {
      await check(await file.text());
    } catch {
      setReport({ status: "error", code: "invalid-json", message: "The browser could not read that file." });
      setAnnounce("The browser could not read that file.");
    }
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    void checkFile(event.dataTransfer.files[0]);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 text-stone-100">
      <h1 className="font-serif text-4xl">Check a proof file</h1>
      <p className="mt-3 text-sm leading-6 text-stone-200">
        Open a <code>gravekeeper-proof.json</code> or a Lantern Hill receipt file. The check runs in this browser tab. The file is never uploaded.
      </p>
      <ProofLimits />

      <label
        htmlFor="proof-file"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-6 block rounded-md border-2 border-dashed p-6 text-center text-sm motion-safe:transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-amber-200 ${
          dragging ? "border-amber-200 bg-stone-900" : "border-stone-500"
        }`}
      >
        <span className="font-medium text-stone-100">Choose a proof file</span>
        <span className="block text-stone-300">or drop it here (JSON, up to 5 MB)</span>
        <input
          id="proof-file"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            void checkFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>

      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void check(pasted);
        }}
      >
        <label htmlFor="proof-paste" className="block text-sm font-medium text-stone-100">
          Or paste proof JSON
        </label>
        <textarea
          id="proof-paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={6}
          spellCheck={false}
          className="mt-2 w-full rounded-md border border-stone-500 bg-stone-950 p-3 font-mono text-xs text-stone-100"
        />
        <button type="submit" disabled={busy} className={`${primary} mt-3`}>
          {busy ? "Checking…" : "Verify pasted text"}
        </button>
      </form>

      <p role="status" className="mt-4 text-sm text-amber-200">
        {announce}
      </p>
      <ProofResult report={report} />
    </main>
  );
}
