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

/** Floor of one comparator token, "" for a wildcard with no bound, null when unparseable. */
function npmTokenFloor(token: string): string | null {
  const exclusive = token.startsWith(">") && !token.startsWith(">=");
  const bare = token.replace(/^(>=|~>|>|=|\^|~)/, "").replace(/^v/i, "");
  const [core, ...rest] = bare.split(/(?=[-+])/);
  const parts = core.split(".");
  if (!parts.length || /^[x*]$/i.test(parts[0])) return "";
  const firstWildcard = parts.findIndex((part) => /^[x*]$/i.test(part));
  const precise = firstWildcard === -1 ? parts : parts.slice(0, firstWildcard);
  // npm exclusive partials / X-ranges raise the last precise component:
  // >1 and >1.x are >=2.0.0, >1.2 and >1.2.x are >=1.3.0.
  // Fully specified versions such as >1.2.3 keep the inclusive floor (1.2.3).
  const isPartialOrWildcard = firstWildcard !== -1 || precise.length < 3;
  if (exclusive && isPartialOrWildcard && rest.length === 0) {
    const last = precise.length - 1;
    const n = Number(precise[last]);
    if (!Number.isSafeInteger(n)) return null;
    const raised = [...precise.slice(0, last), String(n + 1)];
    while (raised.length < 3) raised.push("0");
    const floor = raised.join(".");
    return parseVersion(floor) ? floor : null;
  }
  const floor =
    firstWildcard === -1
      ? core + rest.join("")
      : precise.concat(parts.slice(firstWildcard).map(() => "0")).join(".");
  return parseVersion(floor) ? floor : null;
}

/** A comparator set is an intersection, so its floor is the strongest (highest) lower bound. */
function npmAlternativeFloor(alternative: string): string | null {
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(alternative);
  const tokens = hyphen
    ? [hyphen[1]]
    : alternative
        .replace(/(>=|<=|~>|>|<|=|\^|~)\s+/g, "$1")
        .split(/\s+/)
        .filter(Boolean);
  let highest: string | null = null;
  for (const token of tokens) {
    if (token.startsWith("<")) continue;
    const floor = npmTokenFloor(token);
    if (floor === null) return null;
    if (floor === "") continue;
    if (highest === null || (compareVersions(floor, highest) ?? 0) > 0) highest = floor;
  }
  return highest;
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

/** True when a PEP 440 prefix (e.g. 1.* → [1]) covers this version. */
function pypiPrefixCovers(prefix: number[], version: string): boolean {
  const parsed = parseVersion(version);
  if (!parsed || parsed.epoch !== 0) return false;
  for (let i = 0; i < prefix.length; i++) {
    if ((parsed.release[i] ?? 0) !== prefix[i]) return false;
  }
  return true;
}

/** Lowest version after a prefix exclusion: 1.* → 2.0, 1.2.* → 1.3. */
function pypiBumpPastPrefix(prefix: number[]): string | null {
  if (!prefix.length) return null;
  const next = [...prefix];
  next[next.length - 1] += 1;
  while (next.length < 2) next.push(0);
  const floor = next.join(".");
  return parseVersion(floor) ? floor : null;
}

function pypiFloor(spec: string): string | null {
  let highest: string | null = null;
  const prefixes: number[][] = [];
  const exactExclusions: string[] = [];
  const exactPins: string[] = [];
  for (const clause of spec.replace(/^\(|\)$/g, "").split(",")) {
    const text = clause.trim();
    const lower = /^(===|==|~=|>=|>)\s*(\S+)$/.exec(text);
    if (lower) {
      const rawVersion = lower[2];
      const floor = rawVersion.replace(/\.\*$/, "");
      if (!parseVersion(floor)) continue;
      const wildcardEquality = (lower[1] === "==" || lower[1] === "===") && /\.\*$/.test(rawVersion);
      if ((lower[1] === "==" || lower[1] === "===") && !wildcardEquality) exactPins.push(floor);
      if (highest === null || (compareVersions(floor, highest) ?? 0) > 0) highest = floor;
      continue;
    }
    const excluded = /^!=\s*(\S+)$/.exec(text);
    if (!excluded) continue;
    const raw = excluded[1];
    const prefix = /^(\d+(?:\.\d+)*)\.\*$/.exec(raw);
    if (prefix) {
      const parts = prefix[1].split(".").map(Number);
      if (parts.every((n) => Number.isSafeInteger(n))) prefixes.push(parts);
      continue;
    }
    if (parseVersion(raw.replace(/\.\*$/, ""))) exactExclusions.push(raw.replace(/\.\*$/, ""));
  }
  if (highest === null) return null;
  const uniquePins: string[] = [];
  for (const pin of exactPins) {
    if (!uniquePins.some((existing) => (compareVersions(existing, pin) ?? 1) === 0)) uniquePins.push(pin);
  }
  if (uniquePins.length > 1) return null;
  let floor: string = highest;
  for (let i = 0; i < 8; i++) {
    const covering = prefixes.find((prefix) => pypiPrefixCovers(prefix, floor));
    if (!covering) break;
    const bumped = pypiBumpPastPrefix(covering);
    if (bumped === null) return null;
    if ((compareVersions(bumped, floor) ?? 0) <= 0) return null;
    floor = bumped;
  }
  if (prefixes.some((prefix) => pypiPrefixCovers(prefix, floor))) return null;
  // Exact != that lands on the floor cannot be bumped reliably.
  if (exactExclusions.some((v) => (compareVersions(v, floor) ?? 1) === 0)) return null;
  if (uniquePins.length === 1) {
    const pin = uniquePins[0];
    if ((compareVersions(pin, floor) ?? 0) < 0) return null;
    if (prefixes.some((prefix) => pypiPrefixCovers(prefix, pin))) return null;
    if (exactExclusions.some((v) => (compareVersions(v, pin) ?? 1) === 0)) return null;
    return pin;
  }
  return floor;
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
