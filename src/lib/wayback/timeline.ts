/**
 * Internet Archive CDX life span: pure parsing and aggregation.
 *
 * Isomorphic: used by the route, the browser verifier and the offline verifier
 * (Node native TypeScript). No network, no environment reads.
 */

import type { CdxEvidence, EpitaphTimeline, TimelineYear, WaybackResult } from "@/types";

/** One row per captured month; 1200 rows is 100 years. */
export const CDX_LIMIT = 1200;
export const CDX_MAX_BYTES = 512 * 1024;

const TIMESTAMP = /^(19|20)\d{12}$/;
const STATUS = /^(\d{3}|-)$/;

/** CDX treats a trailing /* as a prefix query; those must not be sent. */
export function isCdxWildcardUrl(url: string): boolean {
  return url.includes("*");
}

export function cdxQueryUrl(url: string): string {
  return (
    "https://web.archive.org/cdx/search/cdx?url=" +
    encodeURIComponent(url) +
    `&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=${CDX_LIMIT}&matchType=exact`
  );
}

function sortedTimestamps(values: unknown[]): values is string[] {
  let previous = "";
  for (const value of values) {
    if (typeof value !== "string" || !TIMESTAMP.test(value) || value < previous) return false;
    previous = value;
  }
  return true;
}

/** Parse a CDX `output=json` body. Returns null for anything malformed. */
export function parseCdxBody(text: string): CdxEvidence | null {
  if (text.length > CDX_MAX_BYTES) return null;
  let rows: unknown;
  try {
    rows = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(rows)) return null;
  if (rows.length === 0) return { limit: CDX_LIMIT, timestamps: [] };
  const [header, ...data] = rows;
  if (
    !Array.isArray(header) ||
    header.length !== 2 ||
    header[0] !== "timestamp" ||
    header[1] !== "statuscode" ||
    data.length > CDX_LIMIT
  )
    return null;
  const timestamps: unknown[] = [];
  for (const row of data) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[1] !== "string" || !STATUS.test(row[1]))
      return null;
    timestamps.push(row[0]);
  }
  if (!sortedTimestamps(timestamps)) return null;
  return { limit: CDX_LIMIT, timestamps };
}

export function isCdxEvidence(value: unknown): value is CdxEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("limit") || !keys.includes("timestamps")) return false;
  const { limit, timestamps } = value as Record<string, unknown>;
  return (
    limit === CDX_LIMIT &&
    Array.isArray(timestamps) &&
    timestamps.length <= CDX_LIMIT &&
    sortedTimestamps(timestamps)
  );
}

function isFailure(value: unknown): value is { code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

const EMPTY = {
  firstCapture: null,
  lastSeen: null,
  capturedMonths: 0,
  yearsOnRecord: 0,
  yearsWithCaptures: 0,
  years: [] as TimelineYear[],
};

/**
 * Derive the displayed timeline from signed evidence.
 * Returns null when the evidence is neither CDX evidence nor a failure code.
 */
export function buildTimeline(body: unknown): EpitaphTimeline | null {
  if (isFailure(body)) return { state: "unavailable", code: body.code, ...EMPTY, years: [] };
  if (!isCdxEvidence(body)) return null;
  const { timestamps, limit } = body;
  if (timestamps.length === 0) return { state: "empty", code: null, ...EMPTY, years: [] };
  const counts = new Map<number, number>();
  for (const timestamp of timestamps) {
    const year = Number(timestamp.slice(0, 4));
    counts.set(year, (counts.get(year) ?? 0) + 1);
  }
  const firstYear = Number(timestamps[0].slice(0, 4));
  const lastYear = Number(timestamps[timestamps.length - 1].slice(0, 4));
  const years: TimelineYear[] = [];
  for (let year = firstYear; year <= lastYear; year++)
    years.push({ year, months: counts.get(year) ?? 0 });
  return {
    state: timestamps.length >= limit ? "truncated" : "complete",
    code: null,
    firstCapture: timestamps[0],
    lastSeen: timestamps[timestamps.length - 1],
    capturedMonths: timestamps.length,
    yearsOnRecord: years.length,
    yearsWithCaptures: counts.size,
    years,
  };
}

/** "19961022173245" → ISO 8601 UTC, or null if not a real date. */
export function timestampToIso(timestamp: string): string | null {
  if (!TIMESTAMP.test(timestamp)) return null;
  const iso = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

/**
 * Snapshot derived from signed CDX evidence when the availability API missed.
 * CDX is collapsed to one row per month, so this is a capture from the latest
 * captured month, not the availability API's "closest" snapshot. Returns null
 * when there is no capture or the constructed URL is not a plain web.archive.org link.
 */
export function deriveCdxFallback(body: unknown, resource: string): WaybackResult | null {
  if (!isCdxEvidence(body) || body.timestamps.length === 0) return null;
  const timestamp = body.timestamps[body.timestamps.length - 1];
  if (timestampToIso(timestamp) === null) return null;
  const snapshotUrl = `https://web.archive.org/web/${timestamp}/${resource}`;
  try {
    const url = new URL(snapshotUrl);
    if (url.protocol !== "https:" || url.hostname !== "web.archive.org" || url.username || url.password || url.port)
      return null;
    new URL(resource);
  } catch {
    return null;
  }
  return { available: true, url: resource, snapshotUrl, timestamp, status: null, source: "cdx-fallback" };
}
