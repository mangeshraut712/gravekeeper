/**
 * Wayback Machine client.
 *
 * Queries the Wayback Machine Availability API:
 *   https://archive.org/wayback/available?url=<url>
 *
 * Returns a typed Result<WaybackResult> — never throws.
 */

import type { Result, WaybackResult } from '@/types/index';

/** Shape of the Wayback Machine Availability API JSON response. */
type WaybackApiResponse = {
  url: string;
  archived_snapshots: {
    closest?: {
      status: string;
      available: boolean;
      url: string;
      timestamp: string;
    };
  };
};

const WAYBACK_API_BASE = 'https://archive.org/wayback/available';
const TIMEOUT_MS = 10_000;

/**
 * Fetch the latest Wayback Machine snapshot for a given URL.
 *
 * @param url - The URL to look up in the Wayback Machine.
 * @returns A `Result<WaybackResult>`:
 *   - `{ ok: true, data: WaybackResult }` when the lookup succeeds (snapshot may or may not exist).
 *   - `{ ok: false, code: 'NETWORK_TIMEOUT' }` when the request exceeds 10 seconds.
 *   - `{ ok: false, code: 'HTTP_ERROR' }` when the API returns a non-2xx status.
 *   - `{ ok: false, code: 'PARSE_ERROR' }` when the response body cannot be parsed.
 *   - `{ ok: false, code: 'WAYBACK_NO_SNAPSHOT' }` when the API responds but has no snapshot.
 */
export async function fetchWaybackSnapshot(
  url: string,
  signal?: AbortSignal,
): Promise<Result<WaybackResult>> {
  const apiUrl = `${WAYBACK_API_BASE}?url=${encodeURIComponent(url)}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // AbortSignal.timeout() causes a DOMException with name 'TimeoutError',
    // or an AbortError depending on the runtime. Handle both.
    if (
      err instanceof DOMException &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      return {
        ok: false,
        error: 'Wayback Machine request timed out after 10 seconds.',
        code: 'NETWORK_TIMEOUT',
      };
    }
    // Any other fetch-level error (DNS failure, connection refused, etc.)
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
      code: 'NETWORK_TIMEOUT',
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `Wayback Machine API returned HTTP ${response.status}`,
      code: 'HTTP_ERROR',
    };
  }

  let body: WaybackApiResponse;
  try {
    body = (await response.json()) as WaybackApiResponse;
  } catch {
    return {
      ok: false,
      error: 'Failed to parse Wayback Machine API response as JSON.',
      code: 'PARSE_ERROR',
    };
  }

  const closest = body?.archived_snapshots?.closest;

  if (!closest || !closest.available) {
    return {
      ok: false,
      error: 'No archived snapshot found for the given URL.',
      code: 'WAYBACK_NO_SNAPSHOT',
    };
  }

  if (typeof closest.url !== 'string' || typeof closest.timestamp !== 'string' ||
      !/^\d{14}$/.test(closest.timestamp) || typeof closest.status !== 'string') {
    return { ok: false, error: 'Invalid archive snapshot response.', code: 'PARSE_ERROR' };
  }

  const result: WaybackResult = {
    available: true,
    url,
    snapshotUrl: closest.url,
    timestamp: closest.timestamp,
    status: closest.status,
  };

  return { ok: true, data: result };
}
