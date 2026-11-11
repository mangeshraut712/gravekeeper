"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { compareVersions } from "@/lib/restoration/compare";
import fixtures from "@/lib/restoration/fixtures.json";
import recorded from "../../public/restoration-report.json";

const action = "inline-flex min-h-11 items-center justify-center rounded-md border border-stone-500 px-4 py-2 text-sm font-medium text-stone-100 hover:border-amber-200 hover:text-amber-200";

function codePoints(value: string) {
  return Array.from(value, (symbol) => `U+${symbol.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" ") || "(empty)";
}

export default function RestorationDemo() {
  const [input, setInput] = useState("👩‍💻!");
  const [result, setResult] = useState<ReturnType<typeof compareVersions> | null>(null);
  const [error, setError] = useState("");
  const fixture = fixtures.find((item) => item.input === input);

  function updateInput(value: string) {
    setInput(value);
    setResult(null);
    setError("");
  }
  function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setResult(compareVersions(input));
      setError("");
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "Could not run this example.");
    }
  }

  return (
    <main className="min-h-screen bg-[#111510] px-5 py-8 text-stone-200 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className={`${action} mb-12`}>← Back to Gravekeeper</Link>
        <p className="text-xs uppercase tracking-[.2em] text-amber-200">Restoration case 001 · MIT-licensed source</p>
        <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-6xl">A second life for Unicode.</h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-stone-300">
          Esrever kept combining marks intact when reversing text. Modern emoji and
          writing systems need more: keep a whole visible character together.
          Run its unchanged source beside a small modernization using Intl.Segmenter.
        </p>
        <div className="my-8 grid gap-3 sm:grid-cols-3">
          {[
            ["Pinned upstream checks", `${recorded.summary.beforePassed}/${recorded.summary.total}`],
            ["Modernized checks", `${recorded.summary.afterPassed}/${recorded.summary.total}`],
            ["New cases fixed", String(recorded.summary.improvements)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-stone-700 bg-stone-900/60 p-5">
              <p className="text-sm text-stone-300">{label}</p>
              <p className="mt-2 font-serif text-4xl text-amber-200">{value}</p>
            </div>
          ))}
        </div>
        <p className="-mt-4 mb-10 text-xs leading-5 text-stone-400">
          Recorded offline fixture checks on {recorded.runtime.node}, Unicode {recorded.runtime.unicode}.
          These 12 examples are not a claim of complete Unicode conformance. The run below happens in your browser.
        </p>

        <section aria-labelledby="try-heading" className="rounded-2xl border border-stone-700 p-5 sm:p-8">
          <h2 id="try-heading" className="font-serif text-3xl">Watch the restoration work</h2>
          <form onSubmit={run} className="mt-6 space-y-4">
            <div>
              <label htmlFor="restoration-example" className="mb-2 block text-sm">Choose a regression example</label>
              <select id="restoration-example" value={fixture?.id ?? "custom"}
                onChange={(event) => {
                  const selected = fixtures.find((item) => item.id === event.target.value);
                  if (selected) updateInput(selected.input);
                }}
                className="min-h-11 w-full rounded-md border border-stone-500 bg-stone-950 px-3 text-stone-100 sm:max-w-sm">
                <option value="custom" disabled>Custom text</option>
                {fixtures.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="restoration-input" className="mb-2 block text-sm">Text to reverse</label>
              <textarea id="restoration-input" value={input} maxLength={512} rows={3}
                aria-describedby="restoration-help" onChange={(event) => updateInput(event.target.value)}
                className="w-full rounded-md border border-stone-500 bg-stone-950 p-3 text-xl text-stone-100" />
              <p id="restoration-help" className="mt-2 text-xs leading-5 text-stone-400">
                Up to 512 UTF-16 code units. Your text stays in this browser; no lookup or server request is made.
              </p>
            </div>
            <button type="submit" className={`${action} border-amber-200 bg-amber-200 text-stone-950 hover:bg-amber-100 hover:text-stone-950`}>Run both versions</button>
          </form>
          {error && <p role="alert" className="mt-5 text-sm text-red-200">{error}</p>}
          <div aria-live="polite" aria-atomic="true" className="mt-6">
            {result ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {[["Before · unchanged esrever", result.before], ["After · modernized reverse", result.after]].map(([label, output]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-stone-600 bg-stone-950/70 p-5">
                      <h3 className="text-sm text-stone-300">{label}</h3>
                      <p dir="auto" className="my-5 whitespace-pre-wrap break-words text-3xl leading-relaxed">{output || "(empty)"}</p>
                      <p className="break-words font-mono text-xs leading-6 text-stone-400">{codePoints(output)}</p>
                    </div>
                  ))}
                </div>
                {fixture ? (
                  <p className="mt-4 text-sm text-amber-100">
                    Expected for this fixture: {JSON.stringify(fixture.expected)}.
                    {" "}Before {result.before === fixture.expected ? "passes" : "fails"}; after {result.after === fixture.expected ? "passes" : "fails"}.
                  </p>
                ) : <p className="mt-4 text-sm text-stone-300">Custom comparison. No expected output or correctness claim is assigned to custom input.</p>}
              </>
            ) : <p className="text-sm text-stone-400">Choose an example or enter your own text, then run both versions.</p>}
          </div>
        </section>

        <section aria-labelledby="evidence-heading" className="mt-10 rounded-2xl border border-stone-700 p-5 sm:p-8">
          <h2 id="evidence-heading" className="font-serif text-3xl">Inspect it. Reproduce it.</h2>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Original work by Mathias Bynens and contributors, used under MIT. The
            default-branch head is dated February 12, 2018. GitHub did not mark this
            project archived when checked on November 6, 2026; “dormant” is our
            description, not a statement from its maintainer.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a className={action} href={recorded.source.url} target="_blank" rel="noopener noreferrer">Inspect pinned source ↗</a>
            <a className={action} href="/restoration-kit.zip" download>Download offline kit</a>
            <a className={action} href="/restoration-report.json" download>Download recorded report</a>
          </div>
          <p className="mt-5 text-sm leading-7 text-stone-300">
            Unzip the kit and run <code className="break-all text-amber-100">node scripts/verify-restoration.mts</code> with Node.js 22.18+.
            No install or network is needed. The verifier checks the original Git
            blob and MIT notice before executing the original, then reruns both
            versions against the same explicit expectations.
          </p>
          <details className="mt-5 text-sm leading-7 text-stone-400">
            <summary className="cursor-pointer py-2 text-stone-200">What this demonstration does and does not prove</summary>
            <p className="mt-2">
              This is a curated modernization of the reverse API, not a full
              package or command-line-tool revival. It does not automatically
              repair arbitrary repositories. Modern behavior follows your
              runtime’s Unicode grapheme data and needs Intl.Segmenter. It is not
              visual bidirectional-text reversal or guaranteed to round-trip every
              possible Unicode string. Old browsers are not supported by the new implementation.
            </p>
            <p className="mt-3">
              A report is not a signed attestation. Verify the pinned source against
              GitHub independently and rerun the code rather than trusting counters
              or a downloaded JSON file. The lookup workbench’s receipt chain is a
              separate record of a lookup, not proof of this code’s correctness.
            </p>
          </details>
        </section>
        <p className="py-10 text-xs leading-6 text-stone-400">Gravekeeper · Good code deserves a second life. No affiliation with or endorsement by the original maintainers.</p>
      </div>
    </main>
  );
}
