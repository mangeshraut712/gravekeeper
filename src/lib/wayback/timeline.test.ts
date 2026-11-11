import { describe, expect, it } from "vitest";
import { safeSnapshotUrl } from "../../client/proof";
import fc from "fast-check";
import {
  CDX_LIMIT,
  buildTimeline,
  cdxQueryUrl,
  deriveCdxFallback,
  isCdxWildcardUrl,
  isCdxEvidence,
  parseCdxBody,
  timestampToIso,
} from "./timeline";

const HEADER = ["timestamp", "statuscode"];
const body = (rows: string[][]) => JSON.stringify([HEADER, ...rows]);

describe("cdxQueryUrl", () => {
  it("encodes the resource and asks for monthly collapse with a limit", () => {
    expect(cdxQueryUrl("http://www.geocities.com/")).toBe(
      "https://web.archive.org/cdx/search/cdx?url=http%3A%2F%2Fwww.geocities.com%2F&output=json&fl=timestamp,statuscode&collapse=timestamp:6&limit=1200&matchType=exact",
    );
  });

  it("flags trailing /* and other asterisks as CDX wildcards", () => {
    expect(isCdxWildcardUrl("https://example.com/*")).toBe(true);
    expect(isCdxWildcardUrl("https://example.com/foo*")).toBe(true);
    expect(isCdxWildcardUrl("https://example.com/")).toBe(false);
  });
});

describe("parseCdxBody", () => {
  it("treats [] as no captures", () => {
    expect(parseCdxBody("[]")).toEqual({ limit: CDX_LIMIT, timestamps: [] });
  });
  it("accepts a header with no rows", () => {
    expect(parseCdxBody(body([]))).toEqual({ limit: CDX_LIMIT, timestamps: [] });
  });
  it("keeps timestamps and drops status codes", () => {
    expect(
      parseCdxBody(body([["19961022173245", "200"], ["19970222174751", "-"]])),
    ).toEqual({ limit: CDX_LIMIT, timestamps: ["19961022173245", "19970222174751"] });
  });
  it.each([
    ["not json", "<html>"],
    ["an object", "{}"],
    ["wrong header", JSON.stringify([["timestamp", "original"], ["19961022173245", "200"]])],
    ["short timestamp", body([["1996102217", "200"]])],
    ["non-string timestamp", JSON.stringify([HEADER, [19961022173245, "200"]])],
    ["bad status", body([["19961022173245", "ok"]])],
    ["extra column", JSON.stringify([HEADER, ["19961022173245", "200", "x"]])],
    ["out of order", body([["19970222174751", "200"], ["19961022173245", "200"]])],
    ["year before 1900", body([["18961022173245", "200"]])],
  ])("rejects %s", (_, text) => {
    expect(parseCdxBody(text)).toBeNull();
  });
  it("rejects more rows than the limit", () => {
    const rows = Array.from({ length: CDX_LIMIT + 1 }, () => ["20000101000000", "200"]);
    expect(parseCdxBody(body(rows))).toBeNull();
  });
  it("rejects bodies over 512 KiB", () => {
    expect(parseCdxBody(" ".repeat(512 * 1024 + 1) + "[]")).toBeNull();
  });
});

describe("isCdxEvidence", () => {
  it.each([
    [{ limit: CDX_LIMIT, timestamps: [], extra: 1 }],
    [{ limit: 5, timestamps: [] }],
    [{ limit: CDX_LIMIT }],
    [{ limit: CDX_LIMIT, timestamps: ["2000"] }],
    [[]],
    [null],
  ])("rejects %j", (value) => {
    expect(isCdxEvidence(value)).toBe(false);
  });
});

describe("buildTimeline", () => {
  it("returns unavailable for a failure code", () => {
    expect(buildTimeline({ code: "NETWORK_TIMEOUT" })).toMatchObject({
      state: "unavailable",
      code: "NETWORK_TIMEOUT",
      capturedMonths: 0,
      years: [],
    });
  });
  it("returns empty for no captures", () => {
    expect(buildTimeline({ limit: CDX_LIMIT, timestamps: [] })?.state).toBe("empty");
  });
  it("returns null for malformed evidence", () => {
    expect(buildTimeline({ limit: CDX_LIMIT, timestamps: ["bad"] })).toBeNull();
    expect(buildTimeline("x")).toBeNull();
  });
  it("fills gap years with zero", () => {
    const timeline = buildTimeline({
      limit: CDX_LIMIT,
      timestamps: ["19961022173245", "19961219233429", "19990101000000"],
    });
    expect(timeline).toEqual({
      state: "complete",
      code: null,
      firstCapture: "19961022173245",
      lastSeen: "19990101000000",
      capturedMonths: 3,
      yearsOnRecord: 4,
      yearsWithCaptures: 2,
      years: [
        { year: 1996, months: 2 },
        { year: 1997, months: 0 },
        { year: 1998, months: 0 },
        { year: 1999, months: 1 },
      ],
    });
  });
  it("marks a result at the row limit as truncated", () => {
    const timestamps = Array.from({ length: CDX_LIMIT }, (_, i) =>
      `${1900 + Math.floor(i / 12)}${String((i % 12) + 1).padStart(2, "0")}01000000`,
    );
    expect(buildTimeline({ limit: CDX_LIMIT, timestamps })?.state).toBe("truncated");
  });
});

describe("timestampToIso", () => {
  it("converts valid timestamps and rejects impossible ones", () => {
    expect(timestampToIso("19961022173245")).toBe("1996-10-22T17:32:45Z");
    expect(timestampToIso("19961322173245")).toBeNull();
  });
});

const timestampArb = fc
  .record({
    year: fc.integer({ min: 1990, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) =>
    `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}120000`,
  );
const evidenceArb = fc
  .array(timestampArb, { minLength: 1, maxLength: 200 })
  .map((values) => ({ limit: CDX_LIMIT, timestamps: [...values].sort() }));

describe("timeline properties", () => {
  it("counts sum to captured months", () => {
    fc.assert(
      fc.property(evidenceArb, (evidence) => {
        const timeline = buildTimeline(evidence)!;
        const sum = timeline.years.reduce((total, year) => total + year.months, 0);
        expect(sum).toBe(timeline.capturedMonths);
        expect(sum).toBe(evidence.timestamps.length);
      }),
    );
  });
  it("years are contiguous, ascending and span first to last", () => {
    fc.assert(
      fc.property(evidenceArb, (evidence) => {
        const timeline = buildTimeline(evidence)!;
        timeline.years.forEach((entry, i) => {
          if (i > 0) expect(entry.year).toBe(timeline.years[i - 1].year + 1);
        });
        expect(timeline.years.length).toBe(timeline.yearsOnRecord);
        expect(timeline.years[0].year).toBe(Number(evidence.timestamps[0].slice(0, 4)));
        expect(timeline.years.at(-1)!.year).toBe(Number(evidence.timestamps.at(-1)!.slice(0, 4)));
      }),
    );
  });
  it("first capture is not after last seen, and bounds hold", () => {
    fc.assert(
      fc.property(evidenceArb, (evidence) => {
        const timeline = buildTimeline(evidence)!;
        expect(timeline.firstCapture! <= timeline.lastSeen!).toBe(true);
        expect(timeline.yearsWithCaptures).toBe(timeline.years.filter((y) => y.months > 0).length);
        for (const year of timeline.years) {
          expect(year.months).toBeGreaterThanOrEqual(0);
          expect(year.months).toBeLessThanOrEqual(timeline.capturedMonths);
        }
        expect(timeline.state === "truncated").toBe(evidence.timestamps.length >= CDX_LIMIT);
      }),
    );
  });
  it("anything the parser accepts is valid evidence with a timeline", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(timestampArb, fc.constantFrom("200", "301", "404", "-")), { maxLength: 100 }),
        (rows) => {
          const sorted = [...rows].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
          const parsed = parseCdxBody(body(sorted));
          expect(parsed).not.toBeNull();
          expect(isCdxEvidence(parsed)).toBe(true);
          expect(buildTimeline(parsed)).not.toBeNull();
        },
      ),
    );
  });
});

describe("deriveCdxFallback", () => {
  const resource = "https://github.com/atom/atom";
  const evidence = { limit: CDX_LIMIT, timestamps: ["20140622190015", "20261001120000"] };

  it("uses the latest captured month and a link safeSnapshotUrl accepts", () => {
    const result = deriveCdxFallback(evidence, resource);
    expect(result).toEqual({
      available: true,
      url: resource,
      snapshotUrl: `https://web.archive.org/web/20261001120000/${resource}`,
      timestamp: "20261001120000",
      status: null,
      source: "cdx-fallback",
    });
    expect(safeSnapshotUrl(result!.snapshotUrl)).toBe(result!.snapshotUrl);
  });

  it("returns null for no captures, failures and malformed evidence", () => {
    expect(deriveCdxFallback({ limit: CDX_LIMIT, timestamps: [] }, resource)).toBeNull();
    expect(deriveCdxFallback({ code: "HTTP_ERROR" }, resource)).toBeNull();
    expect(deriveCdxFallback({ limit: CDX_LIMIT, timestamps: ["../evil"] }, resource)).toBeNull();
    expect(deriveCdxFallback(null, resource)).toBeNull();
  });

  it("does not link an impossible date or an unparseable resource", () => {
    expect(deriveCdxFallback({ limit: CDX_LIMIT, timestamps: ["20261399000000"] }, resource)).toBeNull();
    expect(deriveCdxFallback(evidence, "not a url")).toBeNull();
  });
});
