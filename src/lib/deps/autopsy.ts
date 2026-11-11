/**
 * Build the displayed dependency autopsy from the two signed evidence bodies.
 *
 * Pure and shared by the server, the browser verifier and the offline verifier,
 * so a displayed autopsy that differs from what this function derives fails
 * verification. Returns null for malformed or misaligned evidence.
 */
import type {
  AutopsyDependency,
  DependencyAutopsy,
  DependencyStatus,
  Ecosystem,
  ManifestEvidence,
  RegistryEvidence,
  RegistryOutcome,
} from "@/types";
import { classify, parseVersion, rangeFloor } from "./semver.ts";

export const REGISTRY_BASE: Record<Ecosystem, string> = {
  npm: "https://registry.npmjs.org/",
  pypi: "https://pypi.org/pypi/",
};

const MANIFEST_ECOSYSTEM: Record<string, Ecosystem> = {
  "package.json": "npm",
  "requirements.txt": "pypi",
  "pyproject.toml": "pypi",
};

const GROUPS = new Set(["dependencies", "devDependencies", "requirements", "project"]);
const OUTCOMES = new Set<RegistryOutcome>(["ok", "not-found", "error", "skipped"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isFailureBody(value: unknown): value is { code: string } {
  return isRecord(value) && Object.keys(value).length === 1 && typeof value.code === "string";
}

export function isManifestEvidence(value: unknown): value is ManifestEvidence {
  if (!isRecord(value)) return false;
  const { path, ecosystem, rawSha256, totalDeclared, skippedLines, truncated, packages } = value;
  return (
    typeof path === "string" &&
    MANIFEST_ECOSYSTEM[path] !== undefined &&
    MANIFEST_ECOSYSTEM[path] === ecosystem &&
    typeof rawSha256 === "string" &&
    /^[0-9a-f]{64}$/.test(rawSha256) &&
    isCount(totalDeclared) &&
    isCount(skippedLines) &&
    Array.isArray(packages) &&
    packages.length <= 40 &&
    totalDeclared >= packages.length &&
    truncated === totalDeclared > packages.length &&
    packages.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === "string" &&
        item.name.length > 0 &&
        item.name.length <= 214 &&
        typeof item.spec === "string" &&
        item.spec.length <= 256 &&
        typeof item.group === "string" &&
        GROUPS.has(item.group),
    )
  );
}

function isRegistryEvidence(value: unknown, ecosystem: Ecosystem): value is RegistryEvidence {
  return (
    isRecord(value) &&
    value.registry === REGISTRY_BASE[ecosystem] &&
    Array.isArray(value.results) &&
    value.results.every(
      (item) =>
        isRecord(item) &&
        typeof item.name === "string" &&
        OUTCOMES.has(item.outcome as RegistryOutcome) &&
        (item.outcome === "ok"
          ? typeof item.latest === "string" && item.latest.length <= 128
          : item.latest === null),
    )
  );
}

function emptyCounts(): Record<DependencyStatus, number> {
  return { current: 0, "minor-behind": 0, "major-behind": 0, unknown: 0, "not-found": 0 };
}

function noteFor(
  status: DependencyStatus,
  outcome: RegistryOutcome,
  floor: string | null,
  latest: string | null,
): string | null {
  if (status === "not-found") return "Not found on the registry.";
  if (status !== "unknown") return null;
  if (outcome === "skipped") return "Not a registry version (git, URL, path, alias or workspace spec).";
  if (outcome === "error") return "Registry lookup failed.";
  if (floor === null) return "Declared spec has no lower bound.";
  if (latest === null || !parseVersion(latest)) return "Latest version is not comparable.";
  return null;
}

export function buildAutopsy(manifestBody: unknown, registryBody: unknown): DependencyAutopsy | null {
  if (isFailureBody(manifestBody)) {
    if (registryBody !== null && registryBody !== undefined) return null;
    return {
      state: manifestBody.code === "MANIFEST_NOT_FOUND" ? "no-manifest" : "unavailable",
      manifest: null,
      dependencies: [],
      counts: emptyCounts(),
    };
  }
  if (!isManifestEvidence(manifestBody)) return null;
  const { packages, ...manifestSummary } = manifestBody;
  const manifest = {
    path: manifestSummary.path,
    ecosystem: manifestSummary.ecosystem,
    rawSha256: manifestSummary.rawSha256,
    totalDeclared: manifestSummary.totalDeclared,
    skippedLines: manifestSummary.skippedLines,
    truncated: manifestSummary.truncated,
  };
  if (packages.length === 0) {
    if (registryBody !== null && registryBody !== undefined) return null;
    return { state: "complete", manifest, dependencies: [], counts: emptyCounts() };
  }
  if (
    !isRegistryEvidence(registryBody, manifest.ecosystem) ||
    registryBody.results.length !== packages.length ||
    registryBody.results.some((item, index) => item.name !== packages[index].name)
  )
    return null;
  const counts = emptyCounts();
  let partial = false;
  const dependencies: AutopsyDependency[] = packages.map((item, index) => {
    const { latest, outcome } = registryBody.results[index];
    if (outcome === "error") partial = true;
    const floor = outcome === "skipped" ? null : rangeFloor(item.spec, manifest.ecosystem);
    const status = classify(floor, latest, outcome);
    counts[status]++;
    return {
      name: item.name,
      spec: item.spec,
      group: item.group,
      floor,
      latest,
      status,
      note: noteFor(status, outcome, floor, latest),
    };
  });
  return { state: partial ? "partial" : "complete", manifest, dependencies, counts };
}
