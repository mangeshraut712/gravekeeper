import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResurrectResponse } from "@/types";
import { KIT_MESSAGES, KitStatus, RevivalKitPanel } from "./RevivalKitPanel";

const result = {
  receipts: [],
  evidence: [],
  publicKey: "k",
  spec: { detectedLanguages: [], detectedFramework: null, staleDeps: [], revivalSteps: [], generatedAt: "" },
  wayback: null,
  github: null,
} as unknown as ResurrectResponse;

describe("RevivalKitPanel", () => {
  const html = renderToStaticMarkup(<RevivalKitPanel result={result} url="https://github.com/a/b" />);

  it("labels the section with its heading and offers both native buttons", () => {
    expect(html).toContain('aria-labelledby="kit-title"');
    expect(html).toMatch(/<h3 id="kit-title"[^>]*>Take the plan home<\/h3>/);
    expect(html).toMatch(/<button type="button"[^>]*min-h-11[^>]*aria-describedby="kit-download-status"[^>]*>Download revival kit<\/button>/);
    expect(html).toMatch(/<button type="button"[^>]*aria-describedby="kit-copy-status"[^>]*>Copy issue body<\/button>/);
  });

  it("renders two empty polite status regions before any message", () => {
    expect(html).toMatch(/<p id="kit-download-status" role="status"[^>]*><\/p>/);
    expect(html).toMatch(/<p id="kit-copy-status" role="status"[^>]*><\/p>/);
  });

  it("states the trust limit", () => {
    expect(html).toContain("only after this lookup&#x27;s proof");
    expect(html).toContain("not to the truth of what GitHub or the Archive returned");
  });
});

describe("KitStatus", () => {
  it("shows download and copy messages in separate regions", () => {
    const out = renderToStaticMarkup(
      <KitStatus download={KIT_MESSAGES.downloadRefused} copy={KIT_MESSAGES.copied} />,
    );
    expect(out).toContain(`role="status" class="text-sm text-stone-200 break-all">${KIT_MESSAGES.downloadRefused}</p>`);
    expect(out).toContain(`>${KIT_MESSAGES.copied}</p>`);
  });
  it("words every outcome", () => {
    expect(KIT_MESSAGES.downloaded("f".repeat(64))).toBe("REVIVAL.md downloaded. Proof SHA-256 ffffffffffff…");
    expect(KIT_MESSAGES.copyRefused).toMatch(/not copied: the proof did not verify/);
    expect(KIT_MESSAGES.copyError).toMatch(/same text is in REVIVAL\.md/);
    expect(KIT_MESSAGES.downloadError).toMatch(/could not start/);
  });
});
