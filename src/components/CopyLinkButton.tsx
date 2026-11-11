"use client";

import { useState } from "react";
import { permalinkFor } from "@/shared/permalink";
import { button } from "./styles";

/** Polite status that exists before any message, so screen readers announce changes. */
export function CopyStatus({ message }: { message: string }) {
  return (
    <p id="copy-link-status" role="status" className="text-xs text-stone-300 break-all">
      {message}
    </p>
  );
}

/** Copies the permalink for this lookup. The link contains only the resource URL. */
export function CopyLinkButton({ resource }: { resource: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    const link = permalinkFor(resource, window.location);
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied.");
    } catch {
      setMessage(`Could not copy. Link: ${link}`);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className={button}
        aria-describedby="copy-link-status"
      >
        Copy link
      </button>
      <CopyStatus message={message} />
    </div>
  );
}
