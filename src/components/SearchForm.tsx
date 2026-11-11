"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { ResurrectResponse } from "@/types";
import { normalizePublicUrl } from "@/shared/url";
import { button, primary } from "./styles";

/** Lookup form. Owns request state; reports results to the wrapper. Escape cancels a running lookup. */
export function SearchForm({
  onLoadingChange,
  onResult,
}: {
  onLoadingChange: (loading: boolean) => void;
  onResult: (result: ResurrectResponse | null, resource: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoadingState] = useState(false);
  const pending = useRef<AbortController | null>(null);
  function setLoading(value: boolean) {
    setLoadingState(value);
    onLoadingChange(value);
  }
  useEffect(() => () => pending.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const normalized = normalizePublicUrl(url);
    if (!normalized) {
      setError(
        "Enter a public HTTP(S) URL without credentials, query strings, or local addresses.",
      );
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError("");
    onResult(null, normalized);
    const timeout = setTimeout(() => controller.abort("timeout"), 35_000);
    try {
      const response = await fetch("/api/resurrect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: normalized }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "The lookup failed. Please try again.",
        );
      if (
        !Array.isArray(data.receipts) ||
        !Array.isArray(data.evidence) ||
        typeof data.publicKey !== "string"
      )
        throw new Error(
          "The server returned an incomplete response. Please retry.",
        );
      if (pending.current !== controller) return;
      onResult(data as ResurrectResponse, normalized);
    } catch (cause) {
      if (pending.current !== controller) return;
      setError(
        controller.signal.aborted
          ? "The lookup took too long. Please try again."
          : cause instanceof Error
            ? cause.message
            : "Unable to reach the service. Please try again.",
      );
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }
  function cancel() {
    const controller = pending.current;
    pending.current = null;
    controller?.abort();
    setLoading(false);
    setError("Lookup canceled. You can start another one.");
  }
  useEffect(() => {
    if (!loading) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading]);
  return (
    <>
      <form onSubmit={submit} noValidate>
        <label
          htmlFor="resource-url"
          className="mb-2 block text-xs text-stone-300"
        >
          Repository or website URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="resource-url"
            type="url"
            name="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://github.com/owner/forgotten-project"
            maxLength={2048}
            disabled={loading}
            aria-invalid={Boolean(error)}
            aria-describedby="lookup-privacy lookup-error"
            required
            className="min-h-12 min-w-0 flex-1 rounded-md border border-stone-600 bg-[#10140e] px-4 font-mono text-sm text-stone-100 placeholder:text-stone-400 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading}
            className={`${primary} min-h-12 sm:px-6`}
          >
            {loading ? "Unearthing…" : "Unearth project"}
            <span aria-hidden="true">↗</span>
          </button>
          {loading && (
            <button type="button" onClick={cancel} className={button}>
              Cancel
            </button>
          )}
        </div>
        <p
          id="lookup-error"
          role="status"
          className="mt-3 text-sm text-amber-200"
        >
          {error ||
            (loading
              ? "Checking the Internet Archive and public GitHub history. This may take up to 30 seconds."
              : "")}
        </p>
        <p
          id="lookup-privacy"
          className="mt-3 text-xs leading-5 text-stone-400"
        >
          Public URLs only. Your URL is sent to the Internet Archive and,
          for GitHub repositories, GitHub. Do not enter private links or
          secrets. No account needed.
        </p>
      </form>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="text-stone-400">Need a starting point?</span>
        {[
          "https://github.com/atom/atom",
          "https://github.com/facebookarchive/flux",
        ].map((example) => (
          <button
            key={example}
            type="button"
            disabled={loading}
            onClick={() => {
              setUrl(example);
              setError("");
            }}
            className="min-h-8 font-mono text-stone-300 underline decoration-stone-600 underline-offset-4 hover:text-amber-200 disabled:opacity-50"
          >
            {example.replace("https://github.com/", "")}
          </button>
        ))}
      </div>
    </>
  );
}
