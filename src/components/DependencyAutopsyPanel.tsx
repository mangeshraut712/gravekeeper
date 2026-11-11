import type { AutopsyDependency, DependencyAutopsy, DependencyStatus } from "@/types";

const STATUS: Record<DependencyStatus, { label: string; className: string }> = {
  "major-behind": {
    label: "Major behind",
    className: "border-amber-300/60 bg-amber-300/10 text-amber-200",
  },
  "minor-behind": {
    label: "Minor behind",
    className: "border-stone-400/60 bg-stone-300/5 text-stone-200",
  },
  current: {
    label: "Current",
    className: "border-lime-300/50 bg-lime-300/5 text-lime-200",
  },
  unknown: {
    label: "Unknown",
    className: "border-dashed border-stone-500 text-stone-300",
  },
  "not-found": {
    label: "Not found",
    className: "border-rose-300/50 bg-rose-300/5 text-rose-200",
  },
};

const ORDER: DependencyStatus[] = [
  "major-behind",
  "minor-behind",
  "current",
  "unknown",
  "not-found",
];

const REGISTRY_NAME = { npm: "npm", pypi: "PyPI" } as const;

function Notes({ autopsy }: { autopsy: DependencyAutopsy }) {
  const notes: string[] = [];
  const manifest = autopsy.manifest;
  if (autopsy.state === "no-manifest")
    notes.push(
      "No package.json, requirements.txt or pyproject.toml at the repository root. The revival plan uses metadata only.",
    );
  if (autopsy.state === "unavailable")
    notes.push("The root manifest could not be read. The revival plan uses metadata only.");
  if (autopsy.state === "partial")
    notes.push("Partial result: some registry lookups failed. Those rows are marked Unknown.");
  if (manifest?.truncated)
    notes.push(
      `Showing the first ${autopsy.dependencies.length} of ${manifest.totalDeclared} declared packages.`,
    );
  if (manifest && manifest.skippedLines > 0)
    notes.push(
      `${manifest.skippedLines} ${manifest.skippedLines === 1 ? "entry" : "entries"} in ${manifest.path} could not be parsed and ${manifest.skippedLines === 1 ? "was" : "were"} skipped.`,
    );
  if (manifest && autopsy.dependencies.length === 0)
    notes.push(`${manifest.path} declares no dependencies that Gravekeeper reads.`);
  if (!notes.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm text-amber-100">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  );
}

function Row({ item }: { item: AutopsyDependency }) {
  const status = STATUS[item.status];
  return (
    <tr className="border-t border-stone-700/60 align-top">
      <th scope="row" className="py-2.5 pr-4 text-left font-mono text-xs font-normal text-stone-100">
        {item.name}
        {item.group === "devDependencies" && (
          <span className="ml-2 text-[10px] uppercase tracking-wider text-stone-400">dev</span>
        )}
      </th>
      <td className="py-2.5 pr-4 font-mono text-xs text-stone-300">{item.spec || "(unpinned)"}</td>
      <td className="py-2.5 pr-4 font-mono text-xs text-stone-300">{item.latest ?? "—"}</td>
      <td className="py-2.5">
        <span
          className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${status.className}`}
        >
          {status.label}
        </span>
        {item.note && <p className="mt-1 text-xs text-stone-400">{item.note}</p>}
      </td>
    </tr>
  );
}

/** Declared versions compared with the latest registry release. Text badges, not colour alone. */
export function DependencyAutopsyPanel({ autopsy }: { autopsy: DependencyAutopsy }) {
  const manifest = autopsy.manifest;
  return (
    <section
      aria-labelledby="autopsy-title"
      className="rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="autopsy-title" className="font-serif text-2xl text-stone-100">
          Dependency autopsy
        </h3>
        <span className="rounded-full border border-stone-600 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300">
          {manifest ? `${manifest.path} · ${REGISTRY_NAME[manifest.ecosystem]}` : "No manifest read"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-stone-400">
        Compares the lowest version each dependency declares with the latest release on the
        public registry. It reads declared versions only: no lockfile, no install, and it is
        not a vulnerability scan.
      </p>
      <Notes autopsy={autopsy} />
      {autopsy.dependencies.length > 0 && (
        <>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {ORDER.map((status) => (
              <div key={status} className="rounded-md border border-stone-700/70 px-3 py-2">
                <dt className="text-[10px] uppercase tracking-wider text-stone-400">
                  {STATUS[status].label}
                </dt>
                <dd className="font-serif text-2xl text-stone-100">{autopsy.counts[status]}</dd>
              </div>
            ))}
          </dl>
          <div
            role="region"
            aria-labelledby="autopsy-title"
            tabIndex={0}
            className="mt-5 max-h-[28rem] overflow-auto rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <caption className="sr-only">
                Declared dependencies, latest registry version and status
              </caption>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-stone-400">
                  <th scope="col" className="pb-2 pr-4 font-normal">Package</th>
                  <th scope="col" className="pb-2 pr-4 font-normal">Declared</th>
                  <th scope="col" className="pb-2 pr-4 font-normal">Latest</th>
                  <th scope="col" className="pb-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {autopsy.dependencies.map((item) => (
                  <Row key={`${item.group}:${item.name}`} item={item} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
