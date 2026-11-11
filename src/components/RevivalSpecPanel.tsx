"use client";

import type { ReactNode } from "react";
import type { RevivalSpec } from "@/types";

const chevron =
  "mr-2 inline-block text-amber-200 transition-transform motion-reduce:transition-none group-open:rotate-90 motion-reduce:group-open:rotate-0";

function Section({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      className="group border-t border-stone-700/60 py-3 first:border-t-0"
      open={defaultOpen}
    >
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-stone-100">
        <span className={chevron} aria-hidden="true">
          ▸
        </span>
        {title}
        {count && (
          <span className="ml-3 font-mono text-xs font-normal text-amber-200">
            {count}
          </span>
        )}
      </summary>
      <div className="pt-3 motion-safe:animate-[fade-in_.2s_ease-out]">
        {children}
      </div>
    </details>
  );
}

/** Revival checklist as native, keyboard-operable disclosures (Enter/Space toggle). */
export function RevivalSpecPanel({ spec }: { spec: RevivalSpec }) {
  return (
    <section
      aria-labelledby="plan-title"
      className="rounded-xl border border-stone-700/70 bg-[#171b16] p-5 sm:p-7"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 id="plan-title" className="font-serif text-2xl text-stone-100">
          A path back to life
        </h3>
        <span className="font-mono text-xs text-amber-200">
          {spec.revivalSteps.length} next steps
        </span>
      </div>
      <p className="mb-4 text-xs text-stone-400">
        Metadata-based plan · no source code audit
      </p>
      <Section
        title="Detected stack"
        count={String(spec.detectedLanguages.length)}
      >
        {spec.detectedLanguages.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {spec.detectedLanguages.map((language) => (
              <li
                key={language}
                className="rounded border border-stone-600 px-2.5 py-1 font-mono text-xs text-stone-200"
              >
                {language}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-stone-400">No language reported.</p>
        )}
        {spec.detectedFramework && (
          <p className="mt-3 text-sm text-stone-300">
            Framework: {spec.detectedFramework}
          </p>
        )}
      </Section>
      {spec.staleDeps.length > 0 && (
        <Section title="Maintenance flags" count={String(spec.staleDeps.length)}>
          <ul className="space-y-2 text-sm text-amber-100">
            {spec.staleDeps.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex gap-3">
                <span className="h-fit rounded border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-200">
                  {item.reason}
                </span>
                <span>
                  {item.name}: {item.suggestion ?? item.reason}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section
        title="Revival steps"
        count={String(spec.revivalSteps.length)}
        defaultOpen
      >
        <ol className="space-y-6">
          {spec.revivalSteps.map((step) => (
            <li key={step.order} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-600 font-mono text-xs text-amber-200">
                {String(step.order).padStart(2, "0")}
              </span>
              <div>
                <h4 className="text-sm font-semibold text-stone-100">
                  {step.title}
                </h4>
                <p className="mt-1 text-sm leading-6 text-stone-400">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </section>
  );
}
