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
      <nav aria-label="Site" className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-amber-200">
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
