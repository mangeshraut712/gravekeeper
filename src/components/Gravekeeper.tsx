"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ResurrectResponse } from "@/types";
import { Mark } from "./Mark";
import { ReceiptChainViewer } from "./ReceiptChainViewer";
import { RevivalSpecPanel } from "./RevivalSpecPanel";
import { SearchForm } from "./SearchForm";
import { TombstoneCard } from "./TombstoneCard";
import { DependencyAutopsyPanel } from "./DependencyAutopsyPanel";
import { EpitaphTimeline } from "./EpitaphTimeline";
import { CopyLinkButton } from "./CopyLinkButton";
import { RevivalKitPanel } from "./RevivalKitPanel";
import { permalinkFor } from "@/shared/permalink";
import { button } from "./styles";

function Graveyard() {
  return (
    <div
      className="relative mx-auto w-full max-w-[440px] py-4"
      aria-hidden="true"
    >
      <svg viewBox="0 0 440 340" className="w-full overflow-visible">
        <defs>
          <radialGradient id="moonGlow">
            <stop stopColor="#eac77f" stopOpacity=".18" />
            <stop offset="1" stopColor="#eac77f" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="stone" x2="0" y2="1">
            <stop stopColor="#302e28" />
            <stop offset="1" stopColor="#151714" />
          </linearGradient>
        </defs>
        <circle cx="285" cy="100" r="120" fill="url(#moonGlow)" />
        <circle cx="285" cy="90" r="42" fill="#dfc58c" />
        <circle cx="300" cy="77" r="38" fill="#111510" />
        <g stroke="#4e5144" fill="none">
          <path d="M30 276h378M12 287h415M35 235l10 42M51 246l-6 30M375 247l8 30M396 240l-13 37" />
          <path d="M332 74l8-5 8 5M355 98l6-5 7 5" />
        </g>
        <g transform="translate(63 139) rotate(-10 32 110)">
          <path
            d="M0 136V38a36 36 0 0 1 72 0v98Z"
            fill="#1c211b"
            stroke="#4a4d3d"
          />
          <path d="M24 45h24M36 33v34M18 90h36M23 100h26" stroke="#77775d" />
        </g>
        <path
          d="M152 277V140a66 66 0 0 1 132 0v137Z"
          fill="url(#stone)"
          stroke="#8a7956"
          strokeWidth="1.3"
        />
        <path
          d="M165 265V140a53 53 0 0 1 106 0v125Z"
          fill="none"
          stroke="#554e3e"
        />
        <text
          x="218"
          y="139"
          textAnchor="middle"
          fill="#dfc58c"
          fontSize="19"
          fontFamily="Georgia, serif"
        >
          R.I.P.
        </text>
        <path d="M193 154h50" stroke="#70654c" />
        <text
          x="218"
          y="186"
          textAnchor="middle"
          fill="#bab5a3"
          fontSize="12"
          fontFamily="monospace"
        >
          last commit
        </text>
        <text
          x="218"
          y="207"
          textAnchor="middle"
          fill="#e7dec9"
          fontSize="15"
          fontFamily="Georgia, serif"
        >
          not the end.
        </text>
        <path d="M204 230h28M211 238h14" stroke="#70654c" />
        <g transform="translate(303 185) rotate(10 32 90)">
          <path
            d="M0 90V25a27 27 0 0 1 54 0v65Z"
            fill="#1c211b"
            stroke="#4a4d3d"
          />
          <text
            x="27"
            y="42"
            textAnchor="middle"
            fill="#949781"
            fontSize="16"
            fontFamily="monospace"
          >
            404
          </text>
          <path d="M13 57h28M19 65h16" stroke="#555c49" />
        </g>
        <ellipse
          cx="219"
          cy="278"
          rx="194"
          ry="24"
          fill="#b4c39a"
          opacity=".035"
          className="motion-safe:animate-pulse"
        />
        <g transform="translate(124 250)">
          <path d="M0 25V3h8v22" fill="#9c8b66" />
          <path
            d="M4 0C-3-7 6-9 4-16 12-8 10-2 4 0"
            fill="#f8cd74"
            className="motion-safe:animate-pulse"
          />
        </g>
      </svg>
      <p className="text-center font-mono text-[10px] uppercase tracking-[.24em] text-stone-400">
        Some projects are only sleeping.
      </p>
    </div>
  );
}

function Results({ result, url }: { result: ResurrectResponse; url: string }) {
  return (
    <div className="space-y-6">
      <CopyLinkButton resource={url} />
      <TombstoneCard result={result} url={url} />
      <EpitaphTimeline timeline={result.timeline} />
      {result.autopsy && <DependencyAutopsyPanel autopsy={result.autopsy} />}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {result.spec ? (
          <RevivalSpecPanel
            spec={result.spec}
            usesDependencies={Boolean(result.autopsy?.manifest)}
          />
        ) : (
          <section className="rounded-xl border border-stone-700/70 p-7">
            <h3 className="font-serif text-2xl">No revival plan yet</h3>
            <p className="mt-3 text-sm leading-6 text-stone-400">
              A plan needs public GitHub metadata and commit history. Try a
              repository URL, or retry if an upstream service was unavailable.
            </p>
          </section>
        )}
        <ReceiptChainViewer key={result.publicKey} result={result} url={url} />
      </div>
      {result.spec && result.github && (
        <RevivalKitPanel key={result.publicKey} result={result} url={url} />
      )}
    </div>
  );
}

export default function Gravekeeper() {
  const [resource, setResource] = useState("");
  const [result, setResult] = useState<ResurrectResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (result) resultsHeading.current?.focus();
  }, [result]);
  return (
    <div className="relative min-h-screen overflow-hidden text-stone-200">
      <a
        href="#lookup"
        className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-amber-200 focus:p-3 focus:text-black"
      >
        Skip to lookup
      </a>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-60 top-28 h-[700px] w-[700px] rounded-full bg-amber-100/[.025] blur-3xl"
      />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between border-b border-stone-700/50 px-5 py-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-serif text-xl tracking-wide text-stone-100"
        >
          <Mark className="h-8 w-8 text-amber-200" />
          Gravekeeper
        </Link>
        <nav
          aria-label="Main navigation"
          className="flex items-center gap-5 text-xs text-stone-400"
        >
          <a
            href="#how-it-works"
            className="hidden hover:text-amber-200 sm:block"
          >
            How it works
          </a>
          <a
            href="https://github.com/mangeshraut712/gravekeeper"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-200"
          >
            Source code ↗
          </a>
        </nav>
      </header>
      <main className="relative mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <section className="grid items-center gap-4 pb-9 pt-12 md:grid-cols-[1.25fr_1fr] md:pt-16">
          <div>
            <p className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.19em] text-amber-200">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
              Digital archaeology for the living web
            </p>
            <h1 className="max-w-xl font-serif text-5xl leading-[1.06] tracking-tight text-stone-100 sm:text-6xl lg:text-[72px]">
              Good code deserves
              <br />
              <em className="font-normal text-amber-200">a second life.</em>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-stone-400">
              Unearth forgotten websites and abandoned repositories. Recover
              their history, make a revival plan, and keep a verifiable trail of
              what you found.
            </p>
            <Link href="/restoration" className={`${button} mt-6`}>
              Try a real restoration <span aria-hidden="true">→</span>
            </Link>
            <Link href="/lantern-hill" className={`${button} ml-0 mt-3 sm:ml-3`}>
              Restore a 1999-style page <span aria-hidden="true">→</span>
            </Link>
          </div>
          <Graveyard />
        </section>
        <section
          id="lookup"
          className="scroll-mt-6 rounded-xl border border-stone-600/70 bg-[#1a1e17] p-5 shadow-2xl shadow-black/10 sm:p-7"
          aria-labelledby="lookup-title"
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="lookup-title" className="font-serif text-xl">
              What shall we bring back?
            </h2>
            <span className="hidden font-mono text-[10px] uppercase tracking-widest text-stone-400 sm:block">
              One URL. A new beginning.
            </span>
          </div>
          <SearchForm
            onLoadingChange={setLoading}
            onResult={(next, normalized) => {
              setResult(next);
              setResource(normalized);
              // Shareable link: the address bar names only the resource, never results.
              if (next)
                window.history.replaceState(
                  window.history.state,
                  "",
                  permalinkFor(normalized, window.location),
                );
            }}
          />
        </section>
        <section
          className="mt-10"
          aria-labelledby="results-title"
          aria-busy={loading}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2
              ref={resultsHeading}
              id="results-title"
              tabIndex={-1}
              className="font-serif text-2xl"
            >
              The excavation
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-400">
              {loading
                ? "In progress"
                : result
                  ? "Lookup complete"
                  : "No lookups yet"}
            </span>
          </div>
          {result ? (
            <Results result={result} url={resource} />
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-700/70 px-6 py-12 text-center">
              <Mark
                className={`mb-4 h-10 w-10 text-stone-400 ${loading ? "motion-safe:animate-pulse" : ""}`}
              />
              <h3 className="font-serif text-xl text-stone-300">
                {loading
                  ? "Listening for signs of life…"
                  : "Every abandoned project has a story."}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-400">
                {loading
                  ? "Gathering evidence. A missing archive does not mean a project is gone for good."
                  : "Enter a URL above to discover its past and figure out what comes next. Your findings will appear here."}
              </p>
            </div>
          )}
          {loading && !result && (
            <div className="mt-6">
              <EpitaphTimeline loading />
            </div>
          )}
        </section>
        <section
          id="how-it-works"
          aria-labelledby="how-title"
          className="mt-14 border-t border-stone-700/50 pt-9"
        >
          <h2
            id="how-title"
            className="mb-7 font-mono text-xs uppercase tracking-[.2em] text-stone-400"
          >
            From forgotten to found
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              [
                "01",
                "Unearth the evidence",
                "Look for an archived snapshot and read public repository metadata and recent commit history.",
              ],
              [
                "02",
                "Find a way forward",
                "Get a checklist from repository metadata and the versions declared in the root manifest. It is not a security audit; review licenses and vulnerabilities yourself.",
              ],
              [
                "03",
                "Keep the receipts",
                "Download signed, linked records you can verify offline. Evidence of integrity, not proof of authorship.",
              ],
            ].map(([number, title, description]) => (
              <article key={number}>
                <span className="font-mono text-xs text-amber-200">
                  {number} /
                </span>
                <h3 className="mb-2 mt-3 font-serif text-xl text-stone-200">
                  {title}
                </h3>
                <p className="text-sm leading-6 text-stone-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <p className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-6 text-xs text-stone-400 sm:px-8">
        <span>Gravekeeper · Built for Kiroween 2026</span>
        <span>Open source. No ghosts in the fine print.</span>
      </p>
    </div>
  );
}
