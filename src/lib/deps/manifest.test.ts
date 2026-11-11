import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MAX_PACKAGES,
  normalizePypiName,
  parseManifest,
  parsePackageJson,
  parsePyprojectToml,
  mergePypiSpecs,
  parseRequirement,
  parseRequirementsTxt,
} from "./manifest";

function ok<T>(result: { ok: true; data: T } | { ok: false }): T {
  if (!result.ok) throw new Error("expected ok");
  return result.data;
}

describe("parsePackageJson", () => {
  it("reads dependencies then devDependencies and keeps the first of duplicates", () => {
    const data = ok(
      parsePackageJson(
        JSON.stringify({
          dependencies: { react: "^16.14.0", lodash: " 4.17.0 " },
          devDependencies: { react: "^18.0.0", jest: "~26.0.0" },
        }),
      ),
    );
    expect(data.ecosystem).toBe("npm");
    expect(data.packages).toEqual([
      { name: "react", spec: "^16.14.0", group: "dependencies" },
      { name: "lodash", spec: "4.17.0", group: "dependencies" },
      { name: "jest", spec: "~26.0.0", group: "devDependencies" },
    ]);
    expect(data).toMatchObject({ totalDeclared: 3, skippedLines: 0, truncated: false });
  });

  it("counts non-string entries and malformed tables as skipped", () => {
    const data = ok(
      parsePackageJson(JSON.stringify({ dependencies: { a: 1, b: "^1.0.0" }, devDependencies: [] })),
    );
    expect(data.packages.map((p) => p.name)).toEqual(["b"]);
    expect(data.skippedLines).toBe(2);
  });

  it("handles a BOM and a manifest without dependencies", () => {
    expect(ok(parsePackageJson('\uFEFF{"name":"x"}')).packages).toEqual([]);
  });

  it.each(["not json", "[]", "null", '"string"'])("rejects %j", (text) => {
    const result = parsePackageJson(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PARSE_ERROR");
  });

  it(`caps at ${MAX_PACKAGES} packages and reports the total`, () => {
    const deps = Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`pkg-${i}`, "^1.0.0"]));
    const data = ok(parsePackageJson(JSON.stringify({ dependencies: deps })));
    expect(data.packages).toHaveLength(MAX_PACKAGES);
    expect(data.totalDeclared).toBe(55);
    expect(data.truncated).toBe(true);
  });

  it("property: cap, total and truncated flag agree with the input", () => {
    const table = fc.dictionary(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), fc.string({ maxLength: 8 }), {
      maxKeys: 60,
    });
    fc.assert(
      fc.property(table, table, (dependencies, devDependencies) => {
        const data = ok(parsePackageJson(JSON.stringify({ dependencies, devDependencies })));
        const unique = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
        expect(data.totalDeclared).toBe(unique.size);
        expect(data.packages.length).toBe(Math.min(unique.size, MAX_PACKAGES));
        expect(data.truncated).toBe(unique.size > MAX_PACKAGES);
        expect(new Set(data.packages.map((p) => p.name)).size).toBe(data.packages.length);
      }),
    );
  });
});

describe("parseRequirement", () => {
  it.each([
    ["Django==3.2.4", { name: "django", spec: "==3.2.4" }],
    ["requests >= 2.0, < 3", { name: "requests", spec: ">=2.0,<3" }],
    ["Flask_SQLAlchemy~=2.5", { name: "flask-sqlalchemy", spec: "~=2.5" }],
    ["uvicorn[standard]>=0.20", { name: "uvicorn", spec: ">=0.20" }],
    ["numpy", { name: "numpy", spec: "" }],
    ['pywin32>=300; sys_platform == "win32"', { name: "pywin32", spec: ">=300" }],
    ["zope.interface (>=5.0)", { name: "zope-interface", spec: "(>=5.0)" }],
    ["six==1.*", { name: "six", spec: "==1.*" }],
  ])("%s", (line, expected) => {
    expect(parseRequirement(line)).toEqual(expected);
  });

  it.each([
    "pkg @ https://example.com/pkg.whl",
    "git+https://github.com/a/b.git",
    "./local/path",
    "pkg 1.0",
    "pkg>=",
    "-e .",
    "",
  ])("rejects %j", (line) => {
    expect(parseRequirement(line)).toBeNull();
  });

  it("normalises names per PEP 503", () => {
    expect(normalizePypiName("Foo.Bar__baz")).toBe("foo-bar-baz");
  });
});

describe("parseRequirementsTxt", () => {
  it("handles comments, continuations, options, URLs and duplicates", () => {
    const text = [
      "# pinned deps",
      "Django==3.2.4  # web",
      "",
      "requests>=2.0,\\",
      "   <3",
      "-r other.txt",
      "--index-url https://example.com/simple",
      "-e git+https://github.com/a/b.git#egg=b",
      "https://example.com/pkg.tar.gz",
      "pkg 1.0",
      "django>=4",
      "numpy",
    ].join("\n");
    const data = ok(parseRequirementsTxt(text));
    expect(data.ecosystem).toBe("pypi");
    expect(data.packages).toEqual([
      { name: "django", spec: "==3.2.4,>=4", group: "requirements" },
      { name: "requests", spec: ">=2.0,<3", group: "requirements" },
      { name: "numpy", spec: "", group: "requirements" },
    ]);
    expect(data.skippedLines).toBe(5);
  });

  it("accepts CRLF line endings", () => {
    expect(ok(parseRequirementsTxt("a==1\r\nb==2\r\n")).packages).toHaveLength(2);
  });

  it("caps at the package limit", () => {
    const text = Array.from({ length: 45 }, (_, i) => `pkg${i}==1.0`).join("\n");
    expect(ok(parseRequirementsTxt(text))).toMatchObject({ totalDeclared: 45, truncated: true });
  });
});

describe("mergePypiSpecs", () => {
  it("joins distinct clauses and keeps a bare name from weakening a bound", () => {
    expect(mergePypiSpecs(">=1.0", ">=4.0")).toBe(">=1.0,>=4.0");
    expect(mergePypiSpecs(">=1.0", "")).toBe(">=1.0");
    expect(mergePypiSpecs("", ">=4.0")).toBe(">=4.0");
    expect(mergePypiSpecs(">=1.0", ">=1.0")).toBe(">=1.0");
  });
});

describe("repeated PyPI requirements", () => {
  it("combines unconditional constraints for the same project", () => {
    const data = ok(parseRequirementsTxt("Django>=1.0\nDjango>=4.0\n"));
    expect(data.packages).toEqual([{ name: "django", spec: ">=1.0,>=4.0", group: "requirements" }]);
  });

  it("does the same in pyproject.toml", () => {
    const text = '[project]\ndependencies = ["Django>=1.0", "Django>=4.0"]\n';
    const data = ok(parsePyprojectToml(text));
    expect(data.packages).toEqual([{ name: "django", spec: ">=1.0,>=4.0", group: "project" }]);
  });

  it("keeps a valid spec when merging would exceed the evidence length limit", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `demo>=1.0.${i}`);
    const data = ok(parseRequirementsTxt(lines.join("\n")));
    expect(data.packages).toHaveLength(1);
    expect(data.packages[0]?.name).toBe("demo");
    expect(data.packages[0]?.spec.length ?? 0).toBeLessThanOrEqual(256);
    expect(data.packages[0]?.spec.startsWith(">=1.0.0")).toBe(true);
    expect(data.skippedLines).toBeGreaterThan(0);
  });

  it("merges a late repeat in a large unique list without quadratic cost", () => {
    const count = 8_000;
    const lines = Array.from({ length: count }, (_, i) => `pkg-${String(i).padStart(4, "0")}`);
    lines.push("pkg-0000>=2.0");
    const started = Date.now();
    const data = ok(parseRequirementsTxt(lines.join("\n")));
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(data.totalDeclared).toBe(count);
    expect(data.truncated).toBe(true);
    expect(data.packages[0]).toEqual({ name: "pkg-0000", spec: ">=2.0", group: "requirements" });
    expect(data.packages).toHaveLength(MAX_PACKAGES);
  });
});

describe("parsePyprojectToml", () => {
  it("reads only [project].dependencies, including extras with brackets", () => {
    const text = `
[build-system]
requires = ["setuptools>=61"]

[project]
name = "demo"
dependencies = [
  "httpx>=0.24",  # client
  'pydantic[email]>=2,<3',
  "tomli; python_version < '3.11'",
  "pkg @ https://example.com/pkg.whl",
]

[project.optional-dependencies]
dev = ["pytest"]

[tool.poetry.dependencies]
python = "^3.10"
`;
    const data = ok(parsePyprojectToml(text));
    expect(data.packages).toEqual([
      { name: "httpx", spec: ">=0.24", group: "project" },
      { name: "pydantic", spec: ">=2,<3", group: "project" },
      { name: "tomli", spec: "", group: "project" },
    ]);
    expect(data.skippedLines).toBe(1);
  });

  it("returns no packages without a [project] table or dependencies key", () => {
    expect(ok(parsePyprojectToml('[tool.poetry]\nname = "x"')).packages).toEqual([]);
    expect(ok(parsePyprojectToml('[project]\nname = "x"')).packages).toEqual([]);
  });

  it("rejects an unterminated or non-string array", () => {
    expect(parsePyprojectToml('[project]\ndependencies = ["a"').ok).toBe(false);
    expect(parsePyprojectToml("[project]\ndependencies = [{ a = 1 }]").ok).toBe(false);
  });
});

describe("parseManifest", () => {
  it("dispatches by path", () => {
    expect(ok(parseManifest("package.json", "{}")).ecosystem).toBe("npm");
    expect(ok(parseManifest("requirements.txt", "")).ecosystem).toBe("pypi");
    expect(ok(parseManifest("pyproject.toml", "")).ecosystem).toBe("pypi");
  });
});
