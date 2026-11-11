import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofPage from "@/app/proof/page";
import ProofWorkbench, { ProofResult } from "./ProofWorkbench";
import { SiteFooter } from "./SiteFooter";

describe("proof workbench", () => {
  it("renders an honest empty state with labeled inputs and no verdict", () => {
    const html = renderToStaticMarkup(<ProofPage />);
    expect(html).toContain('for="proof-file"');
    expect(html).toContain('type="file"');
    expect(html).toContain('for="proof-paste"');
    expect(html).toContain('role="status"');
    expect(html).toContain("No proof checked yet");
    expect(html).toContain("never uploaded");
    expect(html).toContain("does not prove who made the file");
    expect(html).not.toContain("Valid:");
    expect(html).not.toContain("Invalid:");
  });

  it("uses motion-safe for the drop-zone transition", () => {
    const html = renderToStaticMarkup(<ProofWorkbench />);
    expect(html).toContain("motion-safe:transition-colors");
    const label = html.match(/<label for="proof-file"[^>]*>/)?.[0] ?? "";
    expect(label).not.toMatch(/(?<![:\w-])transition-/);
  });

  it("shows receipts for valid and invalid results, and specific errors", () => {
    const receipts = [{ seq: 0, kind: "fixture", url: "https://f.test/", fetchedAt: "t", hash: "h", contentSha256: "c" }];
    const valid = renderToStaticMarkup(<ProofResult report={{ status: "valid", format: "receipt-export", receipts, message: "ok" }} />);
    expect(valid).toContain("Valid: internally consistent");
    expect(valid).toContain("1. fixture");
    const invalid = renderToStaticMarkup(<ProofResult report={{ status: "invalid", format: "receipt-export", receipts, message: "bad" }} />);
    expect(invalid).toContain("Invalid: verification failed");
    const error = renderToStaticMarkup(<ProofResult report={{ status: "error", code: "invalid-json", message: "not JSON" }} />);
    expect(error).toContain("Could not read this proof");
    expect(error).not.toContain("Valid");
  });

  it("escapes receipt text rather than injecting markup", () => {
    const receipts = [{ seq: 0, kind: "<img src=x onerror=1>", url: "", fetchedAt: "", hash: "", contentSha256: "" }];
    const html = renderToStaticMarkup(<ProofResult report={{ status: "invalid", format: "receipt-export", receipts, message: "m" }} />);
    expect(html).not.toContain("<img");
  });

  it("links to /proof from the site footer", () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    expect(html).toContain('href="/proof"');
    expect(html).toContain('aria-label="Site"');
  });
});
