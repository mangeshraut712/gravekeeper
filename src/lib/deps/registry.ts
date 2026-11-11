/**
 * Latest-version lookups against the public npm and PyPI registries.
 *
 * Server only. Never throws: every package gets an outcome. Only the latest
 * version string and the outcome are kept; registry bodies are discarded.
 */
import type { DeclaredDependency, Ecosystem, RegistryEvidence, RegistryOutcome } from "@/types";
import { REGISTRY_BASE } from "./autopsy";
import { isNonRegistrySpec } from "./semver";

export const REQUEST_TIMEOUT_MS = 10_000;
export const BATCH_TIMEOUT_MS = 12_000;
export const CONCURRENCY = 4;

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/i;
const PYPI_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

export function isValidPackageName(name: string, ecosystem: Ecosystem): boolean {
  if (ecosystem === "npm") return name.length <= 214 && NPM_NAME.test(name);
  return name.length <= 200 && PYPI_NAME.test(name);
}

export function registryUrl(ecosystem: Ecosystem, name: string): string {
  return ecosystem === "npm"
    ? `${REGISTRY_BASE.npm}${name.replace("/", "%2F")}/latest`
    : `${REGISTRY_BASE.pypi}${encodeURIComponent(name)}/json`;
}

export type LatestVersion = { latest: string | null; outcome: RegistryOutcome };

export async function fetchLatestVersion(
  ecosystem: Ecosystem,
  name: string,
  signal?: AbortSignal,
): Promise<LatestVersion> {
  if (!isValidPackageName(name, ecosystem)) return { latest: null, outcome: "skipped" };
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(registryUrl(ecosystem, name), {
      headers: { Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch {
    return { latest: null, outcome: "error" };
  }
  if (response.status === 404) return { latest: null, outcome: "not-found" };
  if (!response.ok) return { latest: null, outcome: "error" };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { latest: null, outcome: "error" };
  }
  const version =
    ecosystem === "npm"
      ? (body as { version?: unknown } | null)?.version
      : (body as { info?: { version?: unknown } } | null)?.info?.version;
  return typeof version === "string" && version.length > 0 && version.length <= 128
    ? { latest: version, outcome: "ok" }
    : { latest: null, outcome: "error" };
}

/**
 * Look up every package in manifest order with at most CONCURRENCY requests in
 * flight. A batch deadline and the caller's signal stop outstanding work; those
 * packages are recorded as "error".
 */
export async function lookupLatestVersions(
  ecosystem: Ecosystem,
  packages: DeclaredDependency[],
  signal?: AbortSignal,
  options: { batchTimeoutMs?: number; concurrency?: number } = {},
): Promise<RegistryEvidence> {
  const deadline = AbortSignal.timeout(options.batchTimeoutMs ?? BATCH_TIMEOUT_MS);
  const batch = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const results: RegistryEvidence["results"] = packages.map((item) => ({
    name: item.name,
    latest: null,
    outcome: "error",
  }));
  let next = 0;
  async function worker() {
    while (next < packages.length) {
      const index = next++;
      const item = packages[index];
      if (isNonRegistrySpec(item.spec, ecosystem) || !isValidPackageName(item.name, ecosystem)) {
        results[index] = { name: item.name, latest: null, outcome: "skipped" };
        continue;
      }
      if (batch.aborted) continue; // stays "error"
      results[index] = { name: item.name, ...(await fetchLatestVersion(ecosystem, item.name, batch)) };
    }
  }
  const workers = Math.max(1, Math.min(options.concurrency ?? CONCURRENCY, packages.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return { registry: REGISTRY_BASE[ecosystem], results };
}
