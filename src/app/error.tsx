"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col gap-4 px-6 py-16">
      <h1 className="font-serif text-3xl">Gravekeeper hit a snag</h1>
      <p className="text-muted">The page could not finish rendering.</p>
      <button
        type="button"
        onClick={reset}
        className="w-fit rounded-md bg-amber px-4 py-2 font-semibold text-soil"
      >
        Try again
      </button>
    </main>
  );
}
