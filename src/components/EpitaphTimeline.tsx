import type { ReactNode } from "react";
import type { EpitaphTimeline as Timeline } from "@/types";
import { timestampToIso } from "@/lib/wayback/timeline";
import { Mark } from "./Mark";
import { prettyDate } from "./styles";

const REASON: Record<string, string> = {
  NETWORK_TIMEOUT: "the request timed out or could not connect",
  HTTP_ERROR: "the index returned an error status",
  PARSE_ERROR: "the index returned data Gravekeeper could not read",
};

function day(timestamp: string | null) {
  const iso = timestamp ? timestampToIso(timestamp) : null;
  return iso ? prettyDate(iso) : "Unknown";
}

function month(timestamp: string | null) {
  const iso = timestamp ? timestampToIso(timestamp) : null;
  return iso
    ? new Date(iso).toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" })
    : "Unknown";
}

function Frame({ children, busy }: { children: ReactNode; busy?: boolean }) {
  return (
    <section
      aria-labelledby="epitaph-title"
      aria-busy={busy || undefined}
      className="rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="epitaph-title" className="font-serif text-2xl text-stone-100">
          Epitaph
        </h3>
        <span className="rounded-full border border-stone-600 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300">
          Internet Archive capture index
        </span>
      </div>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-sm leading-6 text-stone-400">{children}</p>;
}

/** Bars scale to 12 months, so a full year always looks the same. Decorative: the table carries the data. */
function Chart({ years }: { years: Timeline["years"] }) {
  const width = years.length * 12;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${width} 56`}
      preserveAspectRatio="none"
      className="h-28 w-full"
    >
      <line x1="0" x2={width} y1="52.5" y2="52.5" stroke="#57534e" strokeWidth="1" />
      {years.map((entry, i) =>
        entry.months > 0 ? (
          <rect
            key={entry.year}
            x={i * 12 + 2}
            y={52 - (entry.months / 12) * 48}
            width="8"
            height={(entry.months / 12) * 48}
            fill="#fcd34d"
            opacity={0.85}
          />
        ) : (
          <rect key={entry.year} x={i * 12 + 4} y="49" width="4" height="3" fill="#78716c" />
        ),
      )}
    </svg>
  );
}

/** Life span on the Internet Archive: born, last seen, captured months per year. */
export function EpitaphTimeline({
  timeline,
  loading = false,
}: {
  timeline?: Timeline | null;
  loading?: boolean;
}) {
  if (loading)
    return (
      <Frame busy>
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-300">
          <Mark className="h-5 w-5 text-stone-400 motion-safe:animate-pulse" />
          Reading the Archive&apos;s capture index…
        </p>
      </Frame>
    );
  if (!timeline)
    return (
      <Frame>
        <Note>This result has no life-span data. It may come from an older proof.</Note>
      </Frame>
    );
  if (timeline.state === "unavailable")
    return (
      <Frame>
        <Note>
          The Internet Archive capture index could not be read:{" "}
          {REASON[timeline.code ?? ""] ?? "the lookup failed"}. The rest of the lookup is
          unaffected. Large sites can take longer than the 10-second limit.
        </Note>
      </Frame>
    );
  if (timeline.state === "empty")
    return (
      <Frame>
        <Note>No captures of this exact URL were found in the Internet Archive index.</Note>
      </Frame>
    );
  const first = timeline.years[0].year;
  const last = timeline.years[timeline.years.length - 1].year;
  const busiest = timeline.years.reduce((best, entry) => (entry.months > best.months ? entry : best));
  const summary = `Captured months per year from ${first} to ${last}. Busiest year: ${busiest.year} with ${busiest.months} of 12 months.`;
  return (
    <Frame>
      <Note>
        When the Internet Archive first and last captured this exact URL, and how many months
        of each year have at least one capture.
      </Note>
      <dl className="mt-5 grid grid-cols-2 gap-5 border-y border-stone-700/60 py-5 sm:grid-cols-4">
        {[
          ["Born", day(timeline.firstCapture)],
          ["Last seen", month(timeline.lastSeen)],
          ["Years on record", `${timeline.yearsOnRecord} (${timeline.yearsWithCaptures} with captures)`],
          ["Captured months", timeline.capturedMonths.toLocaleString("en")],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 text-xs text-stone-400">{label}</dt>
            <dd className="text-sm text-stone-100">{value}</dd>
          </div>
        ))}
      </dl>
      {timeline.state === "truncated" && (
        <p className="mt-3 text-sm text-amber-100">
          The index hit Gravekeeper&apos;s {timeline.capturedMonths.toLocaleString("en")}-month
          limit, so later captures may be missing.
        </p>
      )}
      <figure className="mt-5">
        <Chart years={timeline.years} />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-stone-400" aria-hidden="true">
          <span>{first}</span>
          <span>{last}</span>
        </div>
        <figcaption className="mt-2 text-xs leading-5 text-stone-300">
          {summary} Tall bars are busy years; short grey ticks are years with no captures.
        </figcaption>
      </figure>
      <details className="mt-4 rounded-md border border-stone-700/70 px-4 py-2">
        <summary className="min-h-8 cursor-pointer py-1 text-sm text-stone-200 hover:text-amber-200">
          Show captures per year as a table
        </summary>
        <table className="mt-3 w-full max-w-sm border-collapse text-sm">
          <caption className="sr-only">Captured months per year</caption>
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-stone-400">
              <th scope="col" className="pb-2 pr-4 font-normal">Year</th>
              <th scope="col" className="pb-2 font-normal">Months with a capture</th>
            </tr>
          </thead>
          <tbody>
            {timeline.years.map((entry) => (
              <tr key={entry.year} className="border-t border-stone-700/60">
                <th scope="row" className="py-1.5 pr-4 text-left font-mono text-xs font-normal text-stone-100">
                  {entry.year}
                </th>
                <td className="py-1.5 font-mono text-xs text-stone-300">{entry.months}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="mt-4 text-xs leading-5 text-stone-400">
        Months are UTC; &ldquo;last seen&rdquo; is the latest month with a capture. The signed
        receipt shows this is what Gravekeeper received from the Archive, not that the
        Archive&apos;s index is complete or correct.
      </p>
    </Frame>
  );
}
