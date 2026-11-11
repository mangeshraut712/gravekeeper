import type { ResurrectResponse } from "@/types";
import { safeSnapshotUrl } from "@/client/proof";
import { Mark } from "./Mark";
import { button, prettyDate, primary } from "./styles";

/** Server-renderable summary of the resource: epitaph, last push, snapshot date, R.I.P. */
export function TombstoneCard({
  result,
  url,
}: {
  result: ResurrectResponse;
  url: string;
}) {
  const meta = result.github?.meta;
  const snapshot = safeSnapshotUrl(result.wayback?.snapshotUrl ?? null);
  const archiveDate = result.wayback?.timestamp
    ?.match(/^(\d{4})(\d{2})(\d{2})/)
    ?.slice(1)
    .join("-");
  const repoPath = meta
    ? `https://github.com/${encodeURIComponent(meta.owner)}/${encodeURIComponent(meta.repo)}`
    : null;
  return (
    <section
      className="overflow-hidden rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
      aria-labelledby="resource-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 font-mono text-xs uppercase tracking-[.18em] text-amber-200">
            {meta?.archivedByGitHub
              ? "Archived, not forgotten"
              : meta
                ? "Repository discovered"
                : "Archive lookup"}
          </p>
          <h3 id="resource-title" className="break-all font-serif text-3xl">
            {meta?.fullName ?? new URL(url).hostname}
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
            {meta?.description ?? "A trace of what once lived here."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center text-amber-200/70">
          <Mark className="h-12 w-12" />
          <span className="mt-1 font-serif text-xs tracking-[.3em]">R.I.P.</span>
        </div>
      </div>
      <dl className="my-6 grid grid-cols-2 gap-5 border-y border-stone-700/60 py-5 sm:grid-cols-3 lg:grid-cols-5">
        {(meta
          ? [
              ["Last push", prettyDate(meta.pushedAt)],
              ["Archive snapshot", archiveDate ? prettyDate(archiveDate) : "None found"],
              ["Stars", meta.stars.toLocaleString()],
              ["Open issues / PRs", meta.openIssues.toLocaleString()],
              ["License", meta.license ?? "Not detected"],
            ]
          : [
              ["Archive snapshot", archiveDate ? prettyDate(archiveDate) : "None found"],
            ]
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="mb-1 text-xs text-stone-400">{label}</dt>
            <dd className="text-sm text-stone-100">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-3">
        {snapshot && (
          <a
            className={primary}
            href={snapshot}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open archived snapshot <span aria-hidden="true">↗</span>
          </a>
        )}
        {repoPath && (
          <>
            <a
              className={button}
              href={repoPath}
              target="_blank"
              rel="noopener noreferrer"
            >
              View repository <span aria-hidden="true">↗</span>
            </a>
            <a
              className={button}
              href={`${repoPath}/fork`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Fork on GitHub <span aria-hidden="true">↗</span>
            </a>
          </>
        )}
      </div>
      <p className="mt-4 text-xs leading-5 text-stone-400">
        {snapshot
          ? "Archived pages may contain outdated or unsafe content."
          : "No archive snapshot was returned. It may be unavailable, unarchived, or temporarily unreachable."}
        {meta
          ? " Forking opens GitHub, where you review and confirm with your own account."
          : " GitHub metadata is available only for public repository URLs."}
      </p>
    </section>
  );
}
