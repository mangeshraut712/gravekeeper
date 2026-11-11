import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResurrectResponse } from "@/types";
import { TombstoneCard } from "./TombstoneCard";

const base: ResurrectResponse = {
  receipts: [],
  evidence: [],
  spec: null,
  wayback: {
    available: true,
    url: "https://github.com/octo/ghost",
    snapshotUrl: "http://web.archive.org/web/20231015120000/https://github.com/octo/ghost",
    timestamp: "20231015120000",
    status: "200",
  },
  github: {
    meta: {
      owner: "octo",
      repo: "ghost",
      fullName: "octo/ghost",
      description: "A long-dead project",
      stars: 1234,
      forks: 5,
      openIssues: 2,
      license: "MIT",
      defaultBranch: "main",
      pushedAt: "2019-03-04T05:06:07Z",
      archivedByGitHub: true,
    },
    commits: [],
  },
  publicKey: "key",
};

describe("TombstoneCard", () => {
  it("renders epitaph, dates, R.I.P. and a single h3 heading", () => {
    const html = renderToStaticMarkup(
      <TombstoneCard result={base} url="https://github.com/octo/ghost" />,
    );
    expect(html).toContain('aria-labelledby="resource-title"');
    expect(html).toMatch(/<h3 id="resource-title"[^>]*>octo\/ghost<\/h3>/);
    expect(html.match(/<h\d/g)).toHaveLength(1);
    expect(html).toContain("R.I.P.");
    expect(html).toContain("Archived, not forgotten");
    expect(html).toContain("Mar 4, 2019");
    expect(html).toContain("Oct 15, 2023");
    expect(html).toContain("1,234");
  });

  it("links to the snapshot, repository and fork with aria-hidden arrows", () => {
    const html = renderToStaticMarkup(
      <TombstoneCard result={base} url="https://github.com/octo/ghost" />,
    );
    expect(html).toContain(
      'href="https://web.archive.org/web/20231015120000/https://github.com/octo/ghost"',
    );
    expect(html).toContain('href="https://github.com/octo/ghost"');
    expect(html).toContain('href="https://github.com/octo/ghost/fork"');
    expect(html.match(/<span aria-hidden="true">↗<\/span>/g)).toHaveLength(3);
    expect(html).not.toMatch(/[^>]↗(?!<\/span>)/);
    expect(html.match(/rel="noopener noreferrer"/g)).toHaveLength(3);
  });

  it("handles a Wayback-only result using the hostname", () => {
    const html = renderToStaticMarkup(
      <TombstoneCard
        result={{ ...base, github: null }}
        url="https://example.org/old"
      />,
    );
    expect(html).toContain(">example.org</h3>");
    expect(html).toContain("Archive lookup");
    expect(html).toContain("Oct 15, 2023");
    expect(html).not.toContain("Fork on GitHub");
    expect(html).not.toContain("View repository");
    expect(html).toContain("GitHub metadata is available only for public repository URLs.");
  });

  it("shows the Open issues / PRs count alongside the snapshot date", () => {
    const result: ResurrectResponse = {
      ...base,
      github: {
        ...base.github!,
        meta: { ...base.github!.meta!, openIssues: 42 },
      },
    };
    const html = renderToStaticMarkup(
      <TombstoneCard result={result} url="https://github.com/octo/ghost" />,
    );
    expect(html).toContain(">Open issues / PRs</dt>");
    expect(html).toContain(">42</dd>");
    expect(html).toContain(">Archive snapshot</dt>");
    expect(html.indexOf("Archive snapshot")).toBeLessThan(html.indexOf("Open issues / PRs"));
  });

  it("omits the snapshot link when none was found", () => {
    const html = renderToStaticMarkup(
      <TombstoneCard
        result={{ ...base, github: null, wayback: null }}
        url="https://example.org/old"
      />,
    );
    expect(html).toContain("None found");
    expect(html).not.toContain("Open archived snapshot");
    expect(html).toContain("No archive snapshot was returned");
  });
});
