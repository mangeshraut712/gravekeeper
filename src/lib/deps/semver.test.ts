import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  classify,
  compareVersions,
  isNonRegistrySpec,
  majorOf,
  parseVersion,
  rangeFloor,
  severity,
} from "./semver";

describe("parseVersion", () => {
  it.each([
    ["1.2.3", { epoch: 0, release: [1, 2, 3], pre: null }],
    ["v2.0", { epoch: 0, release: [2, 0], pre: null }],
    ["1.0.0-rc.1", { epoch: 0, release: [1, 0, 0], pre: ["rc", 1] }],
    ["1.0.0+build.5", { epoch: 0, release: [1, 0, 0], pre: null }],
    ["2.0rc1", { epoch: 0, release: [2, 0], pre: ["rc", 1] }],
    ["1.4b2", { epoch: 0, release: [1, 4], pre: ["b", 2] }],
    ["1.0.dev3", { epoch: 0, release: [1, 0], pre: [".dev", 3] }],
    ["1.0.post2", { epoch: 0, release: [1, 0], pre: null }],
    ["1!2.0", { epoch: 1, release: [2, 0], pre: null }],
  ])("parses %s", (input, expected) => {
    expect(parseVersion(input)).toEqual(expected);
  });

  it.each(["", "latest", "^1.2.3", "1..2", "abc", "1.2.3 4", "99999999999999999999"])(
    "rejects %j",
    (input) => expect(parseVersion(input)).toBeNull(),
  );
});

describe("compareVersions", () => {
  it.each([
    ["1.2.3", "1.2.4", -1],
    ["1.10.0", "1.9.9", 1],
    ["1.2", "1.2.0", 0],
    ["1.0.0-alpha", "1.0.0", -1],
    ["1.0.0-alpha", "1.0.0-alpha.1", -1],
    ["1.0.0-alpha.1", "1.0.0-alpha.beta", -1],
    ["1.0.0-beta.2", "1.0.0-beta.11", -1],
    ["1.0.0-rc.1", "1.0.0", -1],
    ["1.0.dev1", "1.0a1", -1],
    ["1.0a1", "1.0b1", -1],
    ["1.0b1", "1.0rc1", -1],
    ["1.0rc1", "1.0", -1],
    ["1.0.post1", "1.0", 0],
    ["1!1.0", "2.0", 1],
  ])("%s vs %s → %d", (a, b, expected) => {
    expect(compareVersions(a, b)).toBe(expected);
  });

  it("returns null for non-versions", () => {
    expect(compareVersions("latest", "1.0.0")).toBeNull();
  });
});

describe("rangeFloor (npm)", () => {
  it.each([
    ["^16.14.0", "16.14.0"],
    ["~1.2.3", "1.2.3"],
    [">=2.0.0 <3", "2.0.0"],
    [">= 2.1", "2.1"],
    ["1.2.3", "1.2.3"],
    ["=1.2.3", "1.2.3"],
    ["v1.2.3", "1.2.3"],
    ["1.x", "1.0"],
    ["1.2.*", "1.2.0"],
    ["1.2.3 - 2.0.0", "1.2.3"],
    ["^1.0.0 || ^2.0.0", "1.0.0"],
    ["^2.0.0 || ^1.5.0", "1.5.0"],
    ["^1.0.0-beta.1", "1.0.0-beta.1"],
    // Exclusive partials and X-ranges: npm raises the last precise component
    // (>1 and >1.x admit 2.0.0, not 1.0.0). Fully specified >1.2.3 is unchanged.
    [">1", "2.0.0"],
    [">1.x", "2.0.0"],
    [">1.*", "2.0.0"],
    [">v1", "2.0.0"],
    [">1.2", "1.3.0"],
    [">1.2.x", "1.3.0"],
    [">1.2.3", "1.2.3"],
    [">=1", "1"],
    [">=1.x", "1.0"],
  ])("%s → %s", (spec, floor) => {
    expect(rangeFloor(spec, "npm")).toBe(floor);
  });

  it("classifies >1 / >1.x against latest 2.0.0 as current, not major-behind", () => {
    expect(classify(rangeFloor(">1", "npm"), "2.0.0", "ok")).toBe("current");
    expect(classify(rangeFloor(">1.x", "npm"), "2.0.0", "ok")).toBe("current");
    expect(classify(rangeFloor(">1", "npm"), "3.0.0", "ok")).toBe("major-behind");
  });

  it.each([
    "",
    "*",
    "x",
    "latest",
    "next",
    "<2.0.0",
    "<2 || ^3.0.0",
    "git+https://github.com/a/b.git",
    "github:a/b",
    "a/b#v1",
    "https://example.com/pkg.tgz",
    "file:../local",
    "link:../local",
    "workspace:*",
    "npm:other@^1.0.0",
  ])("no floor for %j", (spec) => {
    expect(rangeFloor(spec, "npm")).toBeNull();
  });
});

describe("rangeFloor (pypi)", () => {
  it.each([
    ["==1.2.3", "1.2.3"],
    [">=2.0,<3", "2.0"],
    ["~=1.4.2", "1.4.2"],
    ["==1.2.*", "1.2"],
    [">=1.0,>=1.5", "1.5"],
    ["(>=1.0)", "1.0"],
    ["===2.0", "2.0"],
    [">1.0", "1.0"],
    // !=1.* excludes the 1.x series, so >=1.0,!=1.* starts at 2.0
    [">=1.0,!=1.*", "2.0"],
    [">=1.5,!=1.*", "2.0"],
    [">=2.0,!=1.*", "2.0"],
    [">=1.2,!=1.2.*", "1.3"],
    ["(>=1.0,!=1.*)", "2.0"],
  ])("%s → %s", (spec, floor) => {
    expect(rangeFloor(spec, "pypi")).toBe(floor);
  });

  it("classifies >=1.0,!=1.* against latest 2.0.0 as current, not major-behind", () => {
    expect(classify(rangeFloor(">=1.0,!=1.*", "pypi"), "2.0.0", "ok")).toBe("current");
    expect(classify(rangeFloor(">=1.0,!=1.*", "pypi"), "3.0.0", "ok")).toBe("major-behind");
  });

  it("returns no floor when an exact != matches the inclusive floor (not reliably bumpable)", () => {
    expect(rangeFloor(">=1.0,!=1.0", "pypi")).toBeNull();
  });

  it("property: >=N,!=N.* floors to N+1 and classifies as current against that latest", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (major) => {
        const floor = rangeFloor(`>=${major},!=${major}.*`, "pypi");
        const next = `${major + 1}.0`;
        expect(floor).not.toBeNull();
        expect(compareVersions(floor!, next)).toBe(0);
        expect(classify(floor, next, "ok")).toBe("current");
      }),
    );
  });

  it.each(["", "<3", "!=1.0", "<=2,!=1.5", "1.0"])("no floor for %j", (spec) => {
    expect(rangeFloor(spec, "pypi")).toBeNull();
  });
});

describe("isNonRegistrySpec", () => {
  it("flags git, URL, path and workspace specs for npm", () => {
    for (const spec of ["git://x", "github:a/b", "a/b", "file:x", "workspace:^", "./x"])
      expect(isNonRegistrySpec(spec, "npm")).toBe(true);
    expect(isNonRegistrySpec("^1.0.0", "npm")).toBe(false);
  });
  it("flags direct references for PyPI", () => {
    expect(isNonRegistrySpec("@ https://x/y.whl", "pypi")).toBe(true);
    expect(isNonRegistrySpec(">=1.0", "pypi")).toBe(false);
  });
});

describe("classify", () => {
  it.each([
    ["16.14.0", "19.2.0", "ok", "major-behind"],
    ["19.0.0", "19.2.0", "ok", "minor-behind"],
    ["19.2.0", "19.2.0", "ok", "current"],
    ["20.0.0", "19.2.0", "ok", "current"],
    ["1.0.0-rc.1", "1.0.0", "ok", "minor-behind"],
    ["0.9.0", "0.10.0", "ok", "minor-behind"],
    [null, "1.0.0", "ok", "unknown"],
    ["1.0.0", null, "ok", "unknown"],
    ["1.0.0", "not-a-version", "ok", "unknown"],
    ["1.0.0", null, "error", "unknown"],
    ["1.0.0", null, "skipped", "unknown"],
    ["1.0.0", null, "not-found", "not-found"],
    ["1!1.0", "2.0", "ok", "current"],
    ["2.0", "1!1.0", "ok", "major-behind"],
  ] as const)("floor %s, latest %s, %s → %s", (floor, latest, outcome, status) => {
    expect(classify(floor, latest, outcome)).toBe(status);
  });

  it("majorOf reads the first release number", () => {
    expect(majorOf("19.2.0")).toBe(19);
    expect(majorOf("nope")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const identifier = fc.oneof(
  fc.nat({ max: 20 }),
  fc.constantFrom("alpha", "beta", "rc", "a", "b", "dev", "x-1"),
);
const versionArb = fc
  .record({
    epoch: fc.oneof({ weight: 5, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: fc.nat({ max: 2 }) }),
    release: fc.array(fc.nat({ max: 12 }), { minLength: 1, maxLength: 4 }),
    pre: fc.option(fc.array(identifier, { minLength: 1, maxLength: 3 }), { nil: null }),
    pep: fc.option(fc.tuple(fc.constantFrom("a", "b", "rc", ".dev"), fc.nat({ max: 9 })), { nil: null }),
  })
  .map(({ epoch, release, pre, pep }) => {
    let text = (epoch ? `${epoch}!` : "") + release.join(".");
    if (pep) text += `${pep[0]}${pep[1]}`;
    else if (pre) text += `-${pre.join(".")}`;
    return text;
  });

const cmp = (a: string, b: string) => compareVersions(a, b) as -1 | 0 | 1;

describe("comparator properties", () => {
  it("every generated version parses", () => {
    fc.assert(fc.property(versionArb, (v) => parseVersion(v) !== null));
  });

  it("is reflexive and pads releases with zeros", () => {
    fc.assert(
      fc.property(versionArb, fc.array(fc.nat({ max: 9 }), { minLength: 1, maxLength: 3 }), (v, release) => {
        expect(cmp(v, v)).toBe(0);
        expect(cmp(release.join("."), `${release.join(".")}.0`)).toBe(0);
      }),
    );
  });

  it("is antisymmetric", () => {
    fc.assert(
      fc.property(versionArb, versionArb, (a, b) => {
        expect(cmp(a, b)).toBe(-cmp(b, a) || 0);
      }),
      { numRuns: 500 },
    );
  });

  it("is transitive", () => {
    fc.assert(
      fc.property(versionArb, versionArb, versionArb, (a, b, c) => {
        const sorted = [a, b, c].sort(cmp);
        expect(cmp(sorted[0], sorted[1])).toBeLessThanOrEqual(0);
        expect(cmp(sorted[1], sorted[2])).toBeLessThanOrEqual(0);
        expect(cmp(sorted[0], sorted[2])).toBeLessThanOrEqual(0);
        if (cmp(a, b) <= 0 && cmp(b, c) <= 0) expect(cmp(a, c)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it("classification is monotone in the floor", () => {
    fc.assert(
      fc.property(versionArb, versionArb, versionArb, (x, y, latest) => {
        const [low, high] = cmp(x, y) <= 0 ? [x, y] : [y, x];
        expect(severity(classify(low, latest, "ok"))).toBeGreaterThanOrEqual(
          severity(classify(high, latest, "ok")),
        );
      }),
      { numRuns: 500 },
    );
  });

  it("floor of ^v, ~v, >=v and ==v equals v up to padding", () => {
    const plain = fc.array(fc.nat({ max: 30 }), { minLength: 1, maxLength: 3 }).map((r) => r.join("."));
    fc.assert(
      fc.property(plain, fc.constantFrom("^", "~", ">="), (v, op) => {
        expect(cmp(rangeFloor(`${op}${v}`, "npm")!, v)).toBe(0);
      }),
    );
    fc.assert(
      fc.property(plain, fc.constantFrom("==", ">=", "~="), (v, op) => {
        expect(cmp(rangeFloor(`${op}${v}`, "pypi")!, v)).toBe(0);
      }),
    );
  });
});

describe("rangeFloor uses the strongest lower bound in a comparator set (PR #7 review)", () => {
  it.each([
    [">=1.0.0 >=2.0.0", "2.0.0"],
    [">=2.0.0 >=1.0.0", "2.0.0"],
    ["^1.2.0 >=1.5.0 <2", "1.5.0"],
    [">=1.0.0 >=2.0.0 || >=1.5.0", "1.5.0"],
    [">=3.0.0 >=4.0.0 || >=1.0.0 >=2.0.0", "2.0.0"],
    ["* >=1.2.0", "1.2.0"],
  ])("%s → %s", (spec, floor) => {
    expect(rangeFloor(spec, "npm")).toBe(floor);
  });

  it("classifies '>=1.0.0 >=2.0.0' against latest 2.0.0 as current", () => {
    expect(classify(rangeFloor(">=1.0.0 >=2.0.0", "npm"), "2.0.0", "ok")).toBe("current");
  });

  it("property: >N and >N.x floor to (N+1).0.0 and classify as current against that latest", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (major) => {
        const floor = `${major + 1}.0.0`;
        expect(rangeFloor(`>${major}`, "npm")).toBe(floor);
        expect(rangeFloor(`>${major}.x`, "npm")).toBe(floor);
        expect(classify(floor, floor, "ok")).toBe("current");
      }),
    );
  });

  it("property: floor is the max lower bound within a set and the min across ||", () => {
    const plain = fc.array(fc.nat({ max: 20 }), { minLength: 3, maxLength: 3 }).map((r) => r.join("."));
    const set = fc.array(fc.tuple(fc.constantFrom(">=", "^", "~", ">", "="), plain), { minLength: 1, maxLength: 4 });
    const max = (vs: string[]) => vs.reduce((a, b) => (cmp(a, b) >= 0 ? a : b));
    const min = (vs: string[]) => vs.reduce((a, b) => (cmp(a, b) <= 0 ? a : b));
    fc.assert(
      fc.property(fc.array(set, { minLength: 1, maxLength: 3 }), (alternatives) => {
        const spec = alternatives.map((s) => s.map(([op, v]) => `${op}${v}`).join(" ")).join(" || ");
        const expected = min(alternatives.map((s) => max(s.map(([, v]) => v))));
        expect(cmp(rangeFloor(spec, "npm")!, expected)).toBe(0);
      }),
      { numRuns: 300 },
    );
  });
});
