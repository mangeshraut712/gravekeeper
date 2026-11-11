export const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-stone-600 px-4 py-2 text-sm font-medium text-stone-100 transition-colors hover:border-amber-300 hover:text-amber-200 disabled:cursor-wait disabled:opacity-50";
export const primary = `${button} border-amber-300 bg-amber-300 text-stone-950 hover:bg-amber-200 hover:text-stone-950`;

export function prettyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      });
}
