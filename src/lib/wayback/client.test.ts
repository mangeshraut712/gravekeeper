/**
 * Unit tests for src/lib/wayback/client.ts
 *
 * All tests mock globalThis.fetch — no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWaybackSnapshot } from './client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal successful Wayback API response body. */
function makeWaybackResponse(opts: {
  available: boolean;
  snapshotUrl?: string;
  timestamp?: string;
  status?: string;
}) {
  return {
    url: 'https://example.com',
    archived_snapshots: opts.available
      ? {
          closest: {
            status: opts.status ?? '200',
            available: true,
            url: opts.snapshotUrl ?? 'https://web.archive.org/web/20231015120000/https://example.com',
            timestamp: opts.timestamp ?? '20231015120000',
          },
        }
      : {
          closest: {
            status: '',
            available: false,
            url: '',
            timestamp: '',
          },
        },
  };
}

/** Create a mock fetch that resolves with the given body and status. */
function mockFetchResponse(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchWaybackSnapshot', () => {
  const TARGET_URL = 'https://example.com';

  beforeEach(() => {
    // Reset any previous mock
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path — snapshot found
  // -------------------------------------------------------------------------

  it('returns ok:true with WaybackResult when a snapshot is available', async () => {
    const mockBody = makeWaybackResponse({
      available: true,
      snapshotUrl: 'https://web.archive.org/web/20231015120000/https://example.com',
      timestamp: '20231015120000',
      status: '200',
    });
    vi.stubGlobal('fetch', mockFetchResponse(mockBody, 200));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(true);
    if (!result.ok) return; // type narrowing

    expect(result.data.available).toBe(true);
    expect(result.data.url).toBe(TARGET_URL);
    expect(result.data.snapshotUrl).toBe(
      'https://web.archive.org/web/20231015120000/https://example.com',
    );
    expect(result.data.timestamp).toBe('20231015120000');
    expect(result.data.status).toBe('200');
  });

  it('calls the Wayback API with the URL encoded in the query string', async () => {
    const mockFetch = mockFetchResponse(makeWaybackResponse({ available: true }), 200);
    vi.stubGlobal('fetch', mockFetch);

    await fetchWaybackSnapshot(TARGET_URL);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('archive.org/wayback/available');
    expect(calledUrl).toContain(encodeURIComponent(TARGET_URL));
  });

  // -------------------------------------------------------------------------
  // No snapshot
  // -------------------------------------------------------------------------

  it('returns WAYBACK_NO_SNAPSHOT when closest.available is false', async () => {
    const mockBody = makeWaybackResponse({ available: false });
    vi.stubGlobal('fetch', mockFetchResponse(mockBody, 200));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('WAYBACK_NO_SNAPSHOT');
  });

  it('returns WAYBACK_NO_SNAPSHOT when archived_snapshots is empty (no closest key)', async () => {
    const mockBody = { url: TARGET_URL, archived_snapshots: {} };
    vi.stubGlobal('fetch', mockFetchResponse(mockBody, 200));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('WAYBACK_NO_SNAPSHOT');
  });

  // -------------------------------------------------------------------------
  // HTTP error
  // -------------------------------------------------------------------------

  it('returns HTTP_ERROR on a 500 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response),
    );

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('HTTP_ERROR');
  });

  it('returns HTTP_ERROR on a 503 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response),
    );

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('HTTP_ERROR');
  });

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  it('returns NETWORK_TIMEOUT when fetch throws a TimeoutError DOMException', async () => {
    const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NETWORK_TIMEOUT');
  });

  it('returns NETWORK_TIMEOUT when fetch throws an AbortError DOMException', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NETWORK_TIMEOUT');
  });

  it('returns NETWORK_TIMEOUT when fetch throws a generic network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NETWORK_TIMEOUT');
  });

  // -------------------------------------------------------------------------
  // Parse error
  // -------------------------------------------------------------------------

  it('returns PARSE_ERROR when the response body is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      } as unknown as Response),
    );

    const result = await fetchWaybackSnapshot(TARGET_URL);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('PARSE_ERROR');
  });
});
