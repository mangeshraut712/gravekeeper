"use client";

import { useState } from "react";
import type { ResurrectResponse } from "@/types";
import { prepareRevivalKit } from "@/client/kit";
import { KIT_FILENAME } from "@/lib/revival/markdown";
import { button } from "./styles";

type Busy = "" | "download" | "copy";

export const KIT_MESSAGES = {
  downloaded: (sha: string) => `${KIT_FILENAME} downloaded. Proof SHA-256 ${sha.slice(0, 12)}…`,
  downloadRefused: "Revival kit not created: the proof did not verify.",
  downloadError: "Download could not start. Please try again.",
  copied: "Issue body copied.",
  copyRefused: "Issue body not copied: the proof did not verify.",
  copyError: `Could not copy. The same text is in ${KIT_FILENAME} under Revival tracking issue.`,
} as const;

/** Two polite regions that exist before any message, so a copy result never hides a download result. */
export function KitStatus({ download, copy }: { download: string; copy: string }) {
  return (
    <>
      <p id="kit-download-status" role="status" className="text-sm text-stone-200 break-all">
        {download}
      </p>
      <p id="kit-copy-status" role="status" className="text-sm text-stone-200">
        {copy}
      </p>
    </>
  );
}

/** Revival kit: REVIVAL.md and a tracking-issue body, built in the browser after verifyProof passes. */
export function RevivalKitPanel({ result, url }: { result: ResurrectResponse; url: string }) {
  const [busy, setBusy] = useState<Busy>("");
  const [downloadMessage, setDownloadMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  async function download() {
    setBusy("download");
    setDownloadMessage("");
    try {
      const kit = await prepareRevivalKit(result, url);
      if (!kit.ok) {
        setDownloadMessage(KIT_MESSAGES.downloadRefused);
        return;
      }
      try {
        const href = URL.createObjectURL(
          new Blob([kit.markdown], { type: "text/markdown;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = href;
        link.download = KIT_FILENAME;
        link.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        setDownloadMessage(KIT_MESSAGES.downloaded(kit.proofSha256));
      } catch {
        setDownloadMessage(KIT_MESSAGES.downloadError);
      }
    } finally {
      setBusy("");
    }
  }

  async function copy() {
    setBusy("copy");
    setCopyMessage("");
    try {
      const kit = await prepareRevivalKit(result, url);
      if (!kit.ok) {
        setCopyMessage(KIT_MESSAGES.copyRefused);
        return;
      }
      try {
        await navigator.clipboard.writeText(kit.issueBody);
        setCopyMessage(KIT_MESSAGES.copied);
      } catch {
        setCopyMessage(KIT_MESSAGES.copyError);
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <section
      aria-labelledby="kit-title"
      className="rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="kit-title" className="font-serif text-2xl text-stone-100">
          Take the plan home
        </h3>
        <span className="rounded-full border border-stone-600 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300">
          Revival kit
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-400">
        {KIT_FILENAME} collects the repository facts, archive snapshot, revival steps, dependency
        autopsy and Epitaph timeline, plus a ready-to-paste &ldquo;Revival tracking issue&rdquo;
        with a checkbox per step. It is built in your browser only after this lookup&apos;s proof
        verifies, and it names the SHA-256 of the proof download. That ties the plan to the signed
        receipts, not to the truth of what GitHub or the Archive returned.
      </p>
      <div className="my-5 flex flex-wrap gap-3">
        <button
          type="button"
          className={button}
          disabled={busy !== ""}
          onClick={download}
          aria-describedby="kit-download-status"
        >
          {busy === "download" ? "Preparing kit…" : "Download revival kit"}
        </button>
        <button
          type="button"
          className={button}
          disabled={busy !== ""}
          onClick={copy}
          aria-describedby="kit-copy-status"
        >
          {busy === "copy" ? "Preparing…" : "Copy issue body"}
        </button>
      </div>
      <KitStatus download={downloadMessage} copy={copyMessage} />
    </section>
  );
}
