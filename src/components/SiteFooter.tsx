import Link from "next/link";

const links = [
  ["/", "Home"],
  ["/restoration", "Restoration"],
  ["/lantern-hill", "Lantern Hill"],
  ["/proof", "Check a proof"],
] as const;

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-stone-700 px-5 py-6 text-sm text-stone-300">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <nav aria-label="Site" className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-amber-200">
              {label}
            </Link>
          ))}
        </nav>
        <p className="flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
          <span>Gravekeeper · Built for Kiroween 2026</span>
          <span>Open source. No ghosts in the fine print.</span>
        </p>
      </div>
    </footer>
  );
}
