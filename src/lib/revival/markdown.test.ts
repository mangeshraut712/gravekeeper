import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { DependencyAutopsy, EpitaphTimeline, ResurrectResponse, RevivalStep } from "@/types";
import {
  buildIssueBody,
  buildRevivalMarkdown,
  escapeMarkdown,
  type RevivalKitInput,
} from "./markdown";

const SHA = "ab".repeat(32);

function steps(n = 3): RevivalStep[] {
  return Array.from({ length: n }, (_, i) => ({
    order: i + 1,
    title: `Step ${i + 1}`,
    description: `Do thing ${i + 1}`,
  }));
}

function input(overrides: Partial<ResurrectResponse> = {}): RevivalKitInput {
  const result: ResurrectResponse = {
    receipts: [
      {
        seq: 0,
        prevHash: null,
        hash: "1".repeat(64),
        kind: "wayback",
        url: "https://github.com/ghost/repo",
        fetchedAt: "2026-11-11T12:00:00.000Z",
        contentSha256: "2".repeat(64),
        signature: "sig",
      },
      {
        seq: 1,
        prevHash: "1".repeat(64),
        hash: "3".repeat(64),
        kind: "spec",
        url: "https://github.com/ghost/repo",
        fetchedAt: "2026-11-11T12:00:01.000Z",
        contentSha256: "4".repeat(64),
        signature: "sig",
      },
    ],
    evidence: [],
    publicKey: "AbC_-123",
    wayback: {
      available: true,
      url: "https://github.com/ghost/repo",
      snapshotUrl: "https://web.archive.org/web/20200101000000/https://github.com/ghost/repo",
      timestamp: "20200101000000",
      status: "200",
    },
    github: {
      meta: {
        owner: "ghost",
        repo: "repo",
        fullName: "ghost/repo",
        description: "A ghostly repo",
        stars: 12,
        forks: 3,
        openIssues: 4,
        license: "MIT",
        defaultBranch: "main",
        pushedAt: "2019-03-02T10:15:00Z",
        archivedByGitHub: true,
      },
      commits: Array.from({ length: 7 }, (_, i) => ({
        sha: `${i}abcdef0123456789`,
        message: `Commit ${i}`,
        authorDate: "2019-03-02T10:15:00Z",
        authorName: "Ghost",
      })),
    },
    spec: {
      detectedLanguages: ["JavaScript"],
      detectedFramework: null,
      staleDeps: [],
      revivalSteps: steps(),
      generatedAt: "2026-11-11T12:00:01.000Z",
    },
    ...overrides,
  };
  return { result, resource: "https://github.com/ghost/repo", proofSha256: SHA };
}

const autopsy: DependencyAutopsy = {
  state: "partial",
  manifest: {
    path: "package.json",
    ecosystem: "npm",
    rawSha256: "c".repeat(64),
    totalDeclared: 2,
    skippedLines: 1,
    truncated: false,
  },
  dependencies: [
    { name: "react", spec: "^15.0.0", group: "dependencies", floor: "15.0.0", latest: "19.2.0", status: "major-behind", note: null },
    { name: "left-pad", spec: "", group: "devDependencies", floor: null, latest: null, status: "unknown", note: "Registry lookup failed." },
  ],
  counts: { "major-behind": 1, "minor-behind": 0, current: 0, unknown: 1, "not-found": 0 },
};

const timeline: EpitaphTimeline = {
  state: "complete",
  code: null,
  firstCapture: "20140622190015",
  lastSeen: "20190412093000",
  capturedMonths: 6,
  yearsOnRecord: 6,
  yearsWithCaptures: 5,
  years: [
    { year: 2014, months: 2 },
    { year: 2015, months: 1 },
    { year: 2016, months: 1 },
    { year: 2017, months: 0 },
    { year: 2018, months: 1 },
    { year: 2019, months: 1 },
  ],
};

describe("escapeMarkdown", () => {
  it("turns HTML into entities", () => {
    expect(escapeMarkdown('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert\\("x"\\)&lt;/script&gt;',
    );
    expect(escapeMarkdown("<img src=x onerror=alert(1)>")).not.toMatch(/[<>]/);
  });
  it("keeps existing entities literal", () => {
    expect(escapeMarkdown("&lt;b&gt; &amp;")).toBe("&amp;lt;b&amp;gt; &amp;amp;");
  });
  it("neutralizes links, images, code, emphasis, tables, mentions, references and math", () => {
    expect(escapeMarkdown("[click](javascript:alert(1))")).toBe("\\[click\\]\\(javascript:alert\\(1\\)\\)");
    expect(escapeMarkdown("![x](https://evil/x.png)")).toBe("\\!\\[x\\]\\(https://evil/x.png\\)");
    expect(escapeMarkdown("`rm -rf` **bold** _em_ ~~gone~~")).toBe(
      "\\`rm -rf\\` \\*\\*bold\\*\\* \\_em\\_ \\~\\~gone\\~\\~",
    );
    expect(escapeMarkdown("a | b")).toBe("a \\| b");
    expect(escapeMarkdown("cc @octocat fixes #12 $x^2$")).toBe("cc \\@octocat fixes \\#12 \\$x^2\\$");
    expect(escapeMarkdown("C:\\path")).toBe("C:\\\\path");
  });
  it("replaces newlines, controls and bidi characters so input cannot start a block", () => {
    expect(escapeMarkdown("line one\n# Heading\r\n- item\u2028x\u202Eevil\u0000")).toBe(
      "line one \\# Heading - item x evil",
    );
  });
  it("handles null and truncates long values by code point", () => {
    expect(escapeMarkdown(null)).toBe("");
    expect(escapeMarkdown("😀".repeat(10), 4)).toBe("😀😀😀😀…");
  });
});

describe("buildRevivalMarkdown", () => {
  it("includes facts, snapshot link, five commits, plan, issue and proof reference", () => {
    const doc = buildRevivalMarkdown(input());
    expect(doc).toMatch(/^# Revival plan: ghost\/repo\n/);
    expect(doc).toContain("| Repository | [ghost/repo](https://github.com/ghost/repo) |");
    expect(doc).toContain("| Description | A ghostly repo |");
    expect(doc).toContain("| Open issues / PRs | 4 |");
    expect(doc).toContain("| Archived on GitHub | Yes |");
    expect(doc).toContain(
      "[Wayback Machine capture of 2020-01-01T00:00:00Z](https://web.archive.org/web/20200101000000/https://github.com/ghost/repo)",
    );
    expect(doc.match(/^- `\dabcdef` /gm)).toHaveLength(5);
    expect(doc).toContain("Showing 5 of 7 commits in the lookup.");
    expect(doc).toContain("1. **Step 1.** Do thing 1");
    expect(doc).toContain("3. **Step 3.** Do thing 3");
    expect(doc).toContain(`- Proof SHA-256: \`${SHA}\``);
    expect(doc).toContain("- Receipts: 2");
    expect(doc).toContain(`- Last receipt hash: \`${"3".repeat(64)}\``);
    expect(doc).toContain("- Public key (Ed25519, base64url): `AbC_-123`");
    expect(doc).toContain("node scripts/verify-proof.ts gravekeeper-proof.json");
    expect(doc).toContain("does not prove authorship");
    expect(doc).not.toContain("## Dependency autopsy");
    expect(doc).not.toContain("## Epitaph timeline");
  });

  it("labels a snapshot taken from the capture index", () => {
    const base = input();
    const md = buildRevivalMarkdown(
      input({
        wayback: {
          ...base.result.wayback!,
          snapshotUrl: "https://web.archive.org/web/20261001120000/https://github.com/octo/ghost",
          timestamp: "20261001120000",
          source: "cdx-fallback",
        },
      }),
    );
    expect(md).toContain("capture from the latest month in the capture index");
    expect(md).toContain("https://web.archive.org/web/20261001120000/");
  });

  it("says None found and does not link an unsafe snapshot URL", () => {
    const base = input();
    const none = buildRevivalMarkdown(input({ wayback: null }));
    expect(none).toContain("## Archive snapshot\n\n- None found");
    const evil = buildRevivalMarkdown(
      input({ wayback: { ...base.result.wayback!, snapshotUrl: "javascript:alert(1)" } }),
    );
    expect(evil).not.toContain("javascript:");
    const other = buildRevivalMarkdown(
      input({ wayback: { ...base.result.wayback!, snapshotUrl: "https://evil.example/web/1/x" } }),
    );
    expect(other).not.toContain("evil.example");
  });

  it("percent-encodes parentheses in snapshot links", () => {
    const base = input();
    const doc = buildRevivalMarkdown(
      input({
        wayback: { ...base.result.wayback!, snapshotUrl: "https://web.archive.org/web/1/https://x.example/a_(b)" },
      }),
    );
    expect(doc).toContain("(https://web.archive.org/web/1/https://x.example/a_%28b%29)");
  });

  it("adds the dependency autopsy table and notes", () => {
    const doc = buildRevivalMarkdown(input({ autopsy }));
    expect(doc).toContain("## Dependency autopsy");
    expect(doc).toContain("- Partial result: some registry lookups failed.");
    expect(doc).toContain("- 1 manifest entries could not be parsed and were skipped.");
    expect(doc).toContain("| react | dependencies | ^15.0.0 | 19.2.0 | Major behind |  |");
    expect(doc).toContain(
      "| left-pad | devDependencies | (unpinned) | Unknown | Unknown | Registry lookup failed. |",
    );
  });

  it("says when there is no manifest", () => {
    const doc = buildRevivalMarkdown(
      input({ autopsy: { ...autopsy, state: "no-manifest", manifest: null, dependencies: [] } }),
    );
    expect(doc).toContain("- No package.json, requirements.txt or pyproject.toml at the repository root.");
    expect(doc).not.toContain("| Package |");
  });

  it("adds the Epitaph timeline, or says why it is missing", () => {
    const doc = buildRevivalMarkdown(input({ timeline }));
    expect(doc).toContain("- Born (first capture): 2014-06-22");
    expect(doc).toContain("- Last seen (latest captured month): 2019-04");
    expect(doc).toContain("- Years on record: 6 (5 with captures)");
    expect(doc).toContain("| 2017 | 0 |");
    const empty = buildRevivalMarkdown(input({ timeline: { ...timeline, state: "empty", years: [] } }));
    expect(empty).toContain("No captures of this exact URL were found");
    const down = buildRevivalMarkdown(
      input({ timeline: { ...timeline, state: "unavailable", code: "NETWORK_TIMEOUT", years: [] } }),
    );
    expect(down).toContain("could not be read (NETWORK\\_TIMEOUT).");
  });

  it("neutralizes a malicious description and commit message", () => {
    const base = input();
    const meta = {
      ...base.result.github!.meta,
      description: "Nice <img src=x onerror=alert(1)>\n\n## Pwned [link](https://evil) @everyone",
    };
    const commits = [
      { sha: "<b>", message: "<script>steal()</script> | cell", authorDate: "x", authorName: "@admin" },
    ];
    const doc = buildRevivalMarkdown(input({ github: { meta, commits } }));
    expect(doc).not.toMatch(/[<>]/);
    expect(doc).not.toMatch(/^## Pwned/m);
    expect(doc).toContain("&lt;img src=x onerror=alert\\(1\\)&gt; \\#\\# Pwned \\[link\\]\\(https://evil\\) \\@everyone");
    expect(doc).toContain("- &lt;b&gt; x, \\@admin: &lt;script&gt;steal\\(\\)&lt;/script&gt; \\| cell");
  });

  it("embeds the exact issue body and is deterministic", () => {
    const value = input({ autopsy, timeline });
    expect(buildRevivalMarkdown(value)).toContain(buildIssueBody(value));
    expect(buildRevivalMarkdown(value)).toBe(buildRevivalMarkdown(structuredClone(value)));
  });
});

describe("buildIssueBody", () => {
  it("has one task checkbox per step, snapshot link and proof hash", () => {
    const body = buildIssueBody(input());
    expect(body.startsWith("### Revival tracking issue\n")).toBe(true);
    expect(body.match(/^- \[ \] /gm)).toHaveLength(3);
    expect(body).toContain("- [ ] 2. Step 2: Do thing 2");
    expect(body).toContain("- Archive snapshot: [Wayback Machine capture");
    expect(body).toContain(`SHA-256 \`${SHA}\``);
  });
  it("escapes a non-hex proof hash instead of putting it in a code span", () => {
    const body = buildIssueBody({ ...input(), proofSha256: "`x`<b>" });
    expect(body).toContain("SHA-256 \\`x\\`&lt;b&gt;");
  });
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

const SPECIALS = "&<>\\`*_[]()#!|~@$";
const nasty = fc.string({
  unit: fc.oneof(
    fc.constantFrom(..."<>&\\`*_[]()#!|~@$\n\r\t\u2028\u202e-+.=:/ \"'".split("")),
    fc.constantFrom("<script>", "</div>", "<img src=x onerror=1>", "&lt;", "javascript:", "](", "\n# "),
    fc.string({ unit: "binary", minLength: 1, maxLength: 1 }),
  ),
  maxLength: 60,
});

function unescape(value: string): string {
  return value
    .replace(/\\(.)/gu, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("revival kit properties", () => {
  it("escapeMarkdown output has no controls, no raw specials, and round-trips", () => {
    fc.assert(
      fc.property(nasty, (s) => {
        const out = escapeMarkdown(s, 10_000);
        expect(out).not.toMatch(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069<>]/);
        // Every special character is preceded by a backslash (or is part of an entity).
        const stripped = out.replace(/\\./gu, "").replace(/&(lt|gt|amp);/g, "");
        for (const char of SPECIALS) expect(stripped).not.toContain(char);
        const normalized = s
          .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069]+/g, " ")
          .trim();
        expect(unescape(out)).toBe(normalized);
      }),
      { numRuns: 300 },
    );
  });

  const stepArb = fc.array(fc.record({ title: nasty, description: nasty }), { minLength: 1, maxLength: 12 });

  it("every plan step appears in REVIVAL.md and the issue, in order, with one checkbox each", () => {
    fc.assert(
      fc.property(stepArb, (raw) => {
        const revivalSteps = raw.map((s, i) => ({ order: i + 1, ...s }));
        const base = input();
        const value = input({ spec: { ...base.result.spec!, revivalSteps } });
        const doc = buildRevivalMarkdown(value);
        const issue = buildIssueBody(value);
        const boxes = issue.split("\n").filter((line) => line.startsWith("- [ ] "));
        expect(boxes).toHaveLength(revivalSteps.length);
        revivalSteps.forEach((step, i) => {
          const title = escapeMarkdown(step.title);
          const description = escapeMarkdown(step.description, 1000);
          expect(boxes[i]).toBe(`- [ ] ${i + 1}. ${title}: ${description}`);
          expect(doc).toContain(`${i + 1}. **${title}.** ${description}`);
        });
        expect(doc).toContain(issue);
      }),
      { numRuns: 150 },
    );
  });

  it("never contains raw < or > from any user-controlled field, and is deterministic", () => {
    fc.assert(
      fc.property(
        fc.record({
          description: nasty,
          fullName: nasty,
          license: nasty,
          branch: nasty,
          message: nasty,
          author: nasty,
          sha: nasty,
          depName: nasty,
          depSpec: nasty,
          latest: nasty,
          note: nasty,
          title: nasty,
          stepDescription: nasty,
          language: nasty,
          code: nasty,
          resource: nasty,
        }),
        (v) => {
          const base = input();
          const value: RevivalKitInput = {
            ...input({
              github: {
                meta: {
                  ...base.result.github!.meta,
                  description: v.description,
                  fullName: v.fullName,
                  license: v.license,
                  defaultBranch: v.branch,
                  owner: v.fullName,
                  repo: v.branch,
                },
                commits: [{ sha: v.sha, message: v.message, authorDate: v.message, authorName: v.author }],
              },
              spec: {
                ...base.result.spec!,
                detectedLanguages: [v.language],
                detectedFramework: v.language,
                revivalSteps: [{ order: 1, title: v.title, description: v.stepDescription }],
              },
              autopsy: {
                ...autopsy,
                dependencies: [{ ...autopsy.dependencies[0], name: v.depName, spec: v.depSpec, latest: v.latest, note: v.note }],
              },
              timeline: { ...timeline, state: "unavailable", code: v.code },
            }),
            resource: v.resource,
          };
          const doc = buildRevivalMarkdown(value);
          expect(doc).not.toMatch(/[<>]/);
          // User text never starts a line: every line begins with fixed generator text.
          for (const line of doc.split("\n"))
            expect(line).toMatch(/^(|#{1,4} .*|\| .*|- .*|\d+\. .*|---|```(sh)?|shasum .*|node .*|[A-Z][a-z].*)$/);
          expect(buildRevivalMarkdown(value)).toBe(doc);
        },
      ),
      { numRuns: 150 },
    );
  });
});
