"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-stone-200">
      <h1 className="font-serif text-4xl">This trail went cold.</h1>
      <p className="my-6 leading-7 text-stone-400">
        Something unexpected interrupted the lookup. Your browser has not
        created a GitHub fork or changed any repository.
      </p>
      <button
        onClick={reset}
        className="min-h-11 rounded border border-amber-200 px-5 py-2 text-amber-200"
      >
        Try again
      </button>
    </main>
  );
}
