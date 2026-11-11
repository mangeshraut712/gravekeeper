/**
 * Parsers for root dependency manifests: package.json, requirements.txt and
 * pyproject.toml [project].dependencies. Pure functions; never throw.
 */
import type { DeclaredDependency, Ecosystem, ManifestPath, Result } from "@/types";
import { MAX_NAME_LENGTH, MAX_PACKAGES, MAX_SPEC_LENGTH } from "./autopsy";

export { MAX_PACKAGES };

/** Entries outside the evidence limits are skipped and counted, never recorded. */
function withinLimits(name: string, spec: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && spec.length <= MAX_SPEC_LENGTH;
}

export type ParsedManifest = {
  ecosystem: Ecosystem;
  totalDeclared: number;
  skippedLines: number;
  truncated: boolean;
  packages: DeclaredDependency[];
};

function finish(
  ecosystem: Ecosystem,
  all: DeclaredDependency[],
  skippedLines: number,
): ParsedManifest {
  return {
    ecosystem,
    totalDeclared: all.length,
    skippedLines,
    truncated: all.length > MAX_PACKAGES,
    packages: all.slice(0, MAX_PACKAGES),
  };
}

function parseError(error: string): Result<never> {
  return { ok: false, error, code: "PARSE_ERROR" };
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

export function parsePackageJson(text: string): Result<ParsedManifest> {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return parseError("package.json is not valid JSON.");
  }
  if (typeof json !== "object" || json === null || Array.isArray(json))
    return parseError("package.json is not a JSON object.");
  const seen = new Set<string>();
  const all: DeclaredDependency[] = [];
  let skipped = 0;
  for (const group of ["dependencies", "devDependencies"] as const) {
    const table = (json as Record<string, unknown>)[group];
    if (table === undefined) continue;
    if (typeof table !== "object" || table === null || Array.isArray(table)) {
      skipped++;
      continue;
    }
    for (const [name, spec] of Object.entries(table)) {
      if (typeof spec !== "string" || !withinLimits(name, spec.trim())) {
        skipped++;
        continue;
      }
      if (seen.has(name)) continue;
      seen.add(name);
      all.push({ name, spec: spec.trim(), group });
    }
  }
  return { ok: true, data: finish("npm", all, skipped) };
}

// ---------------------------------------------------------------------------
// PEP 508 requirement strings (requirements.txt and pyproject.toml)
// ---------------------------------------------------------------------------

const OPERATOR = "(?:===|==|~=|!=|<=|>=|<|>)";
const CLAUSE = `${OPERATOR}\\s*[A-Za-z0-9.*+!_-]+`;
const SPECIFIER_RE = new RegExp(`^\\(?\\s*(?:${CLAUSE}(?:\\s*,\\s*${CLAUSE})*)?\\s*\\)?$`);
const REQUIREMENT_RE = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(?:\[[^\]]*\])?\s*(.*)$/;

/** PEP 503 normalised project name. */
export function normalizePypiName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, "-");
}

/** Join repeated requirement lines for the same project, e.g. >=1.0 then >=4.0. */
export function mergePypiSpecs(current: string, incoming: string): string {
  const a = current.replace(/^\(|\)$/g, "").trim();
  const b = incoming.replace(/^\(|\)$/g, "").trim();
  if (!a) return b;
  if (!b) return a;
  return a === b ? a : `${a},${b}`;
}

function addOrMergePypi(
  all: DeclaredDependency[],
  requirement: { name: string; spec: string },
  group: DeclaredDependency["group"],
  skipped: { n: number },
  byName: Map<string, number>,
): void {
  const index = byName.get(requirement.name);
  if (index === undefined) {
    byName.set(requirement.name, all.length);
    all.push({ ...requirement, group });
    return;
  }
  const merged = mergePypiSpecs(all[index].spec, requirement.spec);
  if (!withinLimits(requirement.name, merged)) {
    skipped.n += 1;
    return;
  }
  all[index] = { ...all[index], spec: merged };
}

/** Parse one PEP 508 requirement. Returns null for direct references and anything unparseable. */
export function parseRequirement(line: string): { name: string; spec: string } | null {
  const withoutMarker = line.split(";")[0].trim();
  if (!withoutMarker || withoutMarker.includes("@") || withoutMarker.includes("://")) return null;
  const match = REQUIREMENT_RE.exec(withoutMarker);
  if (!match) return null;
  const rest = match[2].trim();
  if (!SPECIFIER_RE.test(rest)) return null;
  return { name: normalizePypiName(match[1]), spec: rest.replace(/\s+/g, "") };
}

export function parseRequirementsTxt(text: string): Result<ParsedManifest> {
  const logical = text.replace(/^\uFEFF/, "").replace(/\\\r?\n/g, " ").split(/\r?\n/);
  const all: DeclaredDependency[] = [];
  const skipped = { n: 0 };
  const byName = new Map<string, number>();
  for (const raw of logical) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (!line) continue;
    const requirement = line.startsWith("-") ? null : parseRequirement(line);
    if (!requirement || !withinLimits(requirement.name, requirement.spec)) {
      skipped.n++;
      continue;
    }
    addOrMergePypi(all, requirement, "requirements", skipped, byName);
  }
  return { ok: true, data: finish("pypi", all, skipped.n) };
}

// ---------------------------------------------------------------------------
// pyproject.toml — [project].dependencies only
// ---------------------------------------------------------------------------

/** Read the quoted strings of a TOML array starting at text[start] === "[". */
function readStringArray(text: string, start: number): string[] | null {
  const values: string[] = [];
  let i = start + 1;
  while (i < text.length) {
    const char = text[i];
    if (char === "]") return values;
    if (char === "#") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = "";
      i++;
      while (i < text.length && text[i] !== char) {
        if (char === '"' && text[i] === "\\" && i + 1 < text.length) i++;
        value += text[i];
        i++;
      }
      if (i >= text.length) return null;
      values.push(value);
    } else if (!/[\s,]/.test(char)) {
      return null; // inline tables or bare values are not supported
    }
    i++;
  }
  return null;
}

export function parsePyprojectToml(text: string): Result<ParsedManifest> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.findIndex((line) => /^\s*\[project\]\s*(#.*)?$/.test(line));
  if (header === -1) return { ok: true, data: finish("pypi", [], 0) };
  let end = lines.findIndex((line, index) => index > header && /^\s*\[/.test(line));
  if (end === -1) end = lines.length;
  const table = lines.slice(header + 1, end).join("\n");
  const key = /^\s*dependencies\s*=\s*\[/m.exec(table);
  if (!key) return { ok: true, data: finish("pypi", [], 0) };
  const entries = readStringArray(table, key.index + key[0].length - 1);
  if (!entries) return parseError("pyproject.toml [project].dependencies is not a string array.");
  const all: DeclaredDependency[] = [];
  const skipped = { n: 0 };
  const byName = new Map<string, number>();
  for (const entry of entries) {
    const requirement = parseRequirement(entry);
    if (!requirement || !withinLimits(requirement.name, requirement.spec)) {
      skipped.n++;
      continue;
    }
    addOrMergePypi(all, requirement, "project", skipped, byName);
  }
  return { ok: true, data: finish("pypi", all, skipped.n) };
}

export function parseManifest(path: ManifestPath, text: string): Result<ParsedManifest> {
  switch (path) {
    case "package.json":
      return parsePackageJson(text);
    case "requirements.txt":
      return parseRequirementsTxt(text);
    case "pyproject.toml":
      return parsePyprojectToml(text);
  }
}
