import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Receipt, ResurrectResponse } from "@/types";
import { ProofStatus, ReceiptChainViewer } from "./ReceiptChainViewer";

const receipts: Receipt[] = [
  {
    seq: 0,
    prevHash: null,
    hash: "a".repeat(64),
    kind: "wayback",
    url: "https://archive.org/wayback/available?url=x",
    fetchedAt: "2026-11-03T06:09:00.000Z",
    contentSha256: "b".repeat(64),
    signature: "sig0",
  },
  {
    seq: 1,
    prevHash: "a".repeat(64),
    hash: "c".repeat(64),
    kind: "github-meta",
    url: "https://api.github.com/repos/o/r",
    fetchedAt: "2026-11-03T06:09:01.000Z",
    contentSha256: "d".repeat(64),
    signature: "sig1",
  },
];

const result: ResurrectResponse = {
  receipts,
  evidence: [],
  spec: null,
  wayback: null,
  github: null,
  publicKey: "key",
};

describe("ReceiptChainViewer", () => {
  const html = renderToStaticMarkup(
    <ReceiptChainViewer result={result} url="https://example.org" />,
  );

  it("shows the receipt count under a labelled heading", () => {
    expect(html).toContain('aria-labelledby="proof-title"');
    expect(html).toContain("Leave a paper trail");
    expect(html).toContain("2 linked receipts");
  });

  it("renders one native details element per receipt with its fields", () => {
    expect(html.match(/<details/g)).toHaveLength(2);
    expect(html.match(/<summary/g)).toHaveLength(2);
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
    expect(html).toContain("wayback");
    expect(html).toContain("github-meta");
    expect(html).toContain("2026-11-03T06:09:00.000Z");
    expect(html).toContain("a".repeat(64));
    expect(html).toContain("Content digest");
    expect(html).toContain("b".repeat(64));
    expect(html).toContain(`${"a".repeat(12)}…`);
  });

  it("separates sequence, kind and hash fragment with spaces so the summary's accessible name does not fuse them", () => {
    // Accessible-name computation joins inline elements without adding spaces.
    const summaries = [...html.matchAll(/<summary[^>]*>(.*?)<\/summary>/g)].map((m) => m[1].replace(/<[^>]*>/g, ""));
    expect(summaries).toEqual([`01 wayback ${"a".repeat(12)}…`, `02 github-meta ${"c".repeat(12)}…`]);
  });

  it("offers verify and download buttons and an empty polite status region", () => {
    expect(html).toContain("Verify proof");
    expect(html).toContain("Download proof");
    expect(html).toContain('<span aria-hidden="true">↓</span>');
    expect(html).toMatch(/<p role="status"[^>]*><\/p>/);
  });
});

describe("ProofStatus", () => {
  const msg = "Download could not start. Please try again.";

  it.each(["idle", "running", "valid", "invalid"] as const)(
    "shows a download error in its own status region when verification is %s",
    (verification) => {
      const out = renderToStaticMarkup(
        <ProofStatus verification={verification} downloadError={msg} />,
      );
      expect(out.match(/role="status"/g)).toHaveLength(2);
      expect(out).toMatch(new RegExp(`<p role="status"[^>]*>${msg}</p>`));
    },
  );

  it("keeps the verification result alongside a download error", () => {
    const out = renderToStaticMarkup(
      <ProofStatus verification="valid" downloadError={msg} />,
    );
    expect(out).toContain("Proof internally consistent");
    expect(out).toContain(msg);
  });

  it("renders an empty download region when there is no error", () => {
    const out = renderToStaticMarkup(
      <ProofStatus verification="valid" downloadError="" />,
    );
    expect(out).not.toContain("Download could not start");
    expect(out).toMatch(/<p role="status"[^>]*><\/p>$/);
  });
});
