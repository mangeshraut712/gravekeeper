import Link from "next/link";
import LanternHillProof from "@/components/LanternHillProof";
import { PreviewFrame } from "@/components/PreviewFrame";
import type { buildLanternHillDemo } from "@/lib/restore/demo";

export type LanternHillDemo = Awaited<ReturnType<typeof buildLanternHillDemo>>;

export function LanternHillView({ demo }: { demo: LanternHillDemo }) {
  return <main className="mx-auto max-w-6xl px-5 py-8 text-stone-100 sm:px-8">
    <Link href="/" className="text-amber-200 underline underline-offset-4">← Back to Gravekeeper</Link>
    <p className="mt-8 text-sm text-amber-200">Original fixture · MIT licensed · No upstream requests</p>
    <h1 className="mt-3 font-serif text-4xl">Lantern Hill, brought into the present</h1>
    <p className="mt-4 max-w-3xl leading-7 text-stone-300">{demo.disclosure}</p>
    <p className="mt-3 max-w-3xl leading-7 text-stone-300">The restored document is generated from the before source. This bounded HTML rewriter is not a sanitizer or an automatic repair tool for arbitrary websites. The guestbook is a non-submitting demonstration.</p>
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="before-title">
        <h2 id="before-title" className="mb-3 font-serif text-2xl">Before: modem-era markup</h2>
        <PreviewFrame title="Before: original 1999-style fixture" src="/fixtures/lantern-hill/before" />
      </section>
      <section aria-labelledby="after-title">
        <h2 id="after-title" className="mb-3 font-serif text-2xl">After: generated HTML5</h2>
        <PreviewFrame title="After: generated HTML5 restoration" src="/fixtures/lantern-hill/after" />
      </section>
    </div>
    <section className="mt-10" aria-labelledby="changes-title">
      <h2 id="changes-title" className="font-serif text-2xl">What changed</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-stone-300">{demo.changes.map((change) => <li key={change.rule}>{change.summary} <span className="text-stone-400">({change.count})</span></li>)}</ul>
    </section>
    <LanternHillProof proof={demo.proof} />
  </main>;
}
