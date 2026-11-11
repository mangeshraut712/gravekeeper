/**
 * Internet Archive CDX client: one request for the monthly capture index of a URL.
 * Returns a typed Result<CdxEvidence>; never throws.
 */

import type { CdxEvidence, Result } from "@/types";
import { CDX_MAX_BYTES, cdxQueryUrl, isCdxWildcardUrl, parseCdxBody } from "./timeline";

const TIMEOUT_MS = 10_000;

export async function fetchCdxCaptures(
  url: string,
  signal?: AbortSignal,
): Promise<Result<CdxEvidence>> {
  if (isCdxWildcardUrl(url)) {
    return {
      ok: false,
      error: "CDX wildcard URLs are not queried; they would match more than one page.",
      code: "PARSE_ERROR",
    };
  }
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let text: string;
  try {
    const response = await fetch(cdxQueryUrl(url), {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok)
      return {
        ok: false,
        error: `Internet Archive CDX API returned HTTP ${response.status}`,
        code: "HTTP_ERROR",
      };
    const length = Number(response.headers?.get("content-length") ?? 0);
    if (length > CDX_MAX_BYTES)
      return { ok: false, error: "CDX response is too large.", code: "PARSE_ERROR" };
    text = await response.text();
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof DOMException && err.name === "TimeoutError"
          ? "Internet Archive CDX request timed out after 10 seconds."
          : "Internet Archive CDX request failed or was canceled.",
      code: "NETWORK_TIMEOUT",
    };
  }
  const evidence = parseCdxBody(text);
  if (!evidence)
    return { ok: false, error: "Invalid CDX response.", code: "PARSE_ERROR" };
  return { ok: true, data: evidence };
}
