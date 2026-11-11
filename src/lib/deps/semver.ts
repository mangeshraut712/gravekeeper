/**
 * Small version comparator for npm (semver) and PyPI (common PEP 440 forms).
 *
 * Pure and dependency-free so the browser and the offline verifier can share it.
 * It answers "how far is the declared floor behind latest?", not full range
 * satisfaction. Build metadata and PEP 440 post-releases are ignored for ordering.
 */
import type { DependencyStatus, Ecosystem, RegistryOutcome } from "@/types";

export type ParsedVersion = {
  epoch: number;
  release: number[];
  pre: (number | string)[] | null;
};

const PEP440_PRE: Record<string, string> = {
  a: "a",
  alpha: "a",
  b: "b",
  beta: "b",
  c: "rc",
  rc: "rc",
  pre: "rc",
  preview: "rc",
};

/** "." sorts before "a", so PEP 440 dev releases rank below alpha. */
const DEV = ".dev";

const VERSION_RE = new RegExp(
  "^v?" +
    "(?:(\\d+)!)?" + // 1 epoch
    "(\\d+(?:\\.\\d+)*)" + // 2 release
    "(?:" +
    "-([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)" + // 3 semver pre-release
    "|" +
    "[-_.]?(alpha|beta|preview|pre|rc|a|b|c)[-_.]?(\\d*)" + // 4,5 PEP 440 pre
    ")?" +
    "(?:[-_.]?(?:post|rev|r)[-_.]?\\d*)?" + // PEP 440 post (ignored)
    "(?:[-_.]?dev[-_.]?(\\d*))?" + // 6 PEP 440 dev
    "(?:\\+[0-9A-Za-z.-]+)?$", // build / local (ignored)
  "i",
);

function toNumber(text: string): number | null {
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

export function parseVersion(input: string): ParsedVersion | null {
  if (typeof input !== "string" || input.length > 128) return null;
  const match = VERSION_RE.exec(input.trim());
  if (!match) return null;
  const epoch = match[1] ? toNumber(match[1]) : 0;
  const release = match[2].split(".").map(toNumber);
  if (epoch === null || release.some((part) => part === null)) return null;
  let pre: (number | string)[] | null = null;
  if (match[3]) {
    pre = match[3].split(".").map((id) => (/^\d+$/.test(id) ? (toNumber(id) ?? id) : id));
  } else if (match[4]) {
    pre = [PEP440_PRE[match[4].toLowerCase()], toNumber(match[5] || "0") ?? 0];
  }
  if (match[6] !== undefined) {
    // X.devN sorts before every pre-release of X; a pre-release's own dev is folded into it.
    if (!pre) pre = [DEV, toNumber(match[6] || "0") ?? 0];
  }
  return { epoch, release: release as number[], pre };
}

function sign(value: number): -1 | 0 | 1 {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

function compareIdentifiers(a: number | string, b: number | string): -1 | 0 | 1 {
  if (typeof a === "number" && typeof b === "number") return sign(a - b);
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareParsed(a: ParsedVersion, b: ParsedVersion): -1 | 0 | 1 {
  if (a.epoch !== b.epoch) return sign(a.epoch - b.epoch);
  const length = Math.max(a.release.length, b.release.length);
  for (let i = 0; i < length; i++) {
    const diff = (a.release[i] ?? 0) - (b.release[i] ?? 0);
    if (diff !== 0) return sign(diff);
  }
  if (!a.pre && !b.pre) return 0;
  if (!a.pre) return 1;
  if (!b.pre) return -1;
  const preLength = Math.min(a.pre.length, b.pre.length);
  for (let i = 0; i < preLength; i++) {
    const result = compareIdentifiers(a.pre[i], b.pre[i]);
    if (result !== 0) return result;
  }
  return sign(a.pre.length - b.pre.length);
}

/** -1, 0 or 1; null when either side is not a version. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  return left && right ? compareParsed(left, right) : null;
}

export function majorOf(version: string): number | null {
  return parseVersion(version)?.release[0] ?? null;
}

// ---------------------------------------------------------------------------
// Range floors
// ---------------------------------------------------------------------------

const NPM_NO_REGISTRY = /^(git(\+[a-z]+)?:|git@|github:|gitlab:|bitbucket:|gist:|https?:|file:|link:|workspace:|npm:|portal:|patch:)/i;

/** True when an npm spec points somewhere other than the registry (git, URL, path, alias, workspace). */
export function isNonRegistrySpec(spec: string, ecosystem: Ecosystem): boolean {
  const value = spec.trim();
  if (ecosystem === "pypi") return /^@|:\/\//.test(value);
  return (
    NPM_NO_REGISTRY.test(value) ||
    value.includes("/") ||
    value.includes(":") ||
    /^[.~]\//.test(value)
  );
}

function npmAlternativeFloor(alternative: string): string | null {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(alternative);
  const candidates = hyphen
    ? [hyphen[1]]
    : alternative
        .replace(/(>=|<=|~>|>|<|=|\^|~)\s+/g, "$1")
        .split(/\s+/)
        .filter(Boolean);
  const lower = candidates.find((token) => !token.startsWith("<"));
  if (!lower) return null;
  const bare = lower.replace(/^(>=|~>|>|=|\^|~)/, "").replace(/^v/i, "");
  const [core, ...rest] = bare.split(/(?=[-+])/);
  const parts = core.split(".");
  if (!parts.length || /^[x*]$/i.test(parts[0])) return null;
  const firstWildcard = parts.findIndex((part) => /^[x*]$/i.test(part));
  const release =
    firstWildcard === -1
      ? core
      : parts
          .slice(0, firstWildcard)
          .concat(parts.slice(firstWildcard).map(() => "0"))
          .join(".");
  const floor = firstWildcard === -1 ? release + rest.join("") : release;
  return parseVersion(floor) ? floor : null;
}

function npmFloor(spec: string): string | null {
  const value = spec.trim();
  if (!value || isNonRegistrySpec(value, "npm")) return null;
  let lowest: string | null = null;
  for (const alternative of value.split("||")) {
    const floor = npmAlternativeFloor(alternative.trim());
    if (floor === null) return null; // one unbounded alternative makes the whole range unbounded
    if (lowest === null || (compareVersions(floor, lowest) ?? 0) < 0) lowest = floor;
  }
  return lowest;
}

function pypiFloor(spec: string): string | null {
  let highest: string | null = null;
  for (const clause of spec.replace(/^\(|\)$/g, "").split(",")) {
    const match = /^(===|==|~=|>=|>)\s*(\S+)$/.exec(clause.trim());
    if (!match) continue;
    const floor = match[2].replace(/\.\*$/, "");
    if (!parseVersion(floor)) continue;
    if (highest === null || (compareVersions(floor, highest) ?? 0) > 0) highest = floor;
  }
  return highest;
}

/** The lowest version a declared spec admits, or null when it has no registry floor. */
export function rangeFloor(spec: string, ecosystem: Ecosystem): string | null {
  if (typeof spec !== "string" || spec.length > 256) return null;
  return ecosystem === "npm" ? npmFloor(spec) : pypiFloor(spec);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

export function classify(
  floor: string | null,
  latest: string | null,
  outcome: RegistryOutcome,
): DependencyStatus {
  if (outcome === "not-found") return "not-found";
  if (outcome !== "ok" || floor === null || latest === null) return "unknown";
  const f = parseVersion(floor);
  const l = parseVersion(latest);
  if (!f || !l) return "unknown";
  if (f.epoch !== l.epoch) return f.epoch < l.epoch ? "major-behind" : "current";
  if (f.release[0] < l.release[0]) return "major-behind";
  return compareParsed(f, l) < 0 ? "minor-behind" : "current";
}

/** current < minor-behind < major-behind; -1 for statuses without an ordering. */
export function severity(status: DependencyStatus): number {
  return status === "current" ? 0 : status === "minor-behind" ? 1 : status === "major-behind" ? 2 : -1;
}
