/** Shareable result links: `/?url=<encoded>`. Browser-safe and pure. */
import { normalizePublicUrl } from "./url";

export type PermalinkRequest =
  | { kind: "none" }
  | { kind: "rejected" }
  | { kind: "lookup"; url: string };

/** Read `?url=` from a location search string. Only public URLs are accepted. */
export function readPermalink(search: string): PermalinkRequest {
  const values = new URLSearchParams(search).getAll("url");
  if (values.length === 0) return { kind: "none" };
  if (values.length > 1) return { kind: "rejected" };
  const url = normalizePublicUrl(values[0]);
  return url ? { kind: "lookup", url } : { kind: "rejected" };
}

/** Link that reopens the lookup for `resource`. Contains only the resource URL. */
export function permalinkFor(
  resource: string,
  location: { origin: string; pathname: string },
): string {
  return `${location.origin}${location.pathname}?url=${encodeURIComponent(resource)}`;
}
