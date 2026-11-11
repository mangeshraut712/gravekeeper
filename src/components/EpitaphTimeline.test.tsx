import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CDX_LIMIT, buildTimeline } from "@/lib/wayback/timeline";
import type { EpitaphTimeline as Timeline } from "@/types";
import { EpitaphTimeline } from "./EpitaphTimeline";
import { CopyLinkButton, CopyStatus } from "./CopyLinkButton";

const timeline = buildTimeline({
  limit: CDX_LIMIT,
  timestamps: ["19961022173245", "19961219233429", "19990301000000", "20091026000000"],
}) as Timeline;

describe("EpitaphTimeline", () => {
  it("shows born, last seen and years on record under a labelled section", () => {
    const html = renderToStaticMarkup(<EpitaphTimeline timeline={timeline} />);
    expect(html).toContain('aria-labelledby="epitaph-title"');
    expect(html).toContain('<h3 id="epitaph-title"');
    expect(html).toContain("Born</dt>");
    expect(html).toContain("Oct 22, 1996");
    expect(html).toContain("Oct 2009");
    expect(html).toContain("14 (3 with captures)");
  });
  it("hides the chart from assistive tech and gives a text summary and table", () => {
    const html = renderToStaticMarkup(<EpitaphTimeline timeline={timeline} />);
    expect(html).toMatch(/<svg aria-hidden="true" focusable="false"/);
    expect(html).toContain("<figcaption");
    expect(html).toContain("Busiest year: 1996 with 2 of 12 months.");
    expect(html).toContain("<details");
    expect(html).toContain("<caption");
    expect(html).toContain('<th scope="col"');
    expect(html.match(/<th scope="row"/g)).toHaveLength(14);
    expect(html).not.toMatch(/animate-|transition/);
  });
  it("states the trust limit", () => {
    expect(renderToStaticMarkup(<EpitaphTimeline timeline={timeline} />)).toContain(
      "not that the Archive&#x27;s index is complete or correct",
    );
  });
  it("renders a loading state with only motion-safe animation", () => {
    const html = renderToStaticMarkup(<EpitaphTimeline loading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Reading the Archive");
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).not.toContain("<svg aria-hidden=\"true\" focusable");
  });
  it("renders missing, empty and unavailable states without a chart", () => {
    const missing = renderToStaticMarkup(<EpitaphTimeline timeline={undefined} />);
    expect(missing).toContain("no life-span data");
    const empty = renderToStaticMarkup(
      <EpitaphTimeline timeline={buildTimeline({ limit: CDX_LIMIT, timestamps: [] })} />,
    );
    expect(empty).toContain("No captures of this exact URL");
    const failed = renderToStaticMarkup(
      <EpitaphTimeline timeline={buildTimeline({ code: "NETWORK_TIMEOUT" })} />,
    );
    expect(failed).toContain("could not be read: the request timed out");
    for (const html of [missing, empty, failed]) expect(html).not.toContain("<table");
  });
  it("says when the index hit the row limit", () => {
    const html = renderToStaticMarkup(
      <EpitaphTimeline timeline={{ ...timeline, state: "truncated" }} />,
    );
    expect(html).toContain("later captures may be missing");
  });
});

describe("CopyLinkButton", () => {
  it("renders a button tied to an empty polite status region", () => {
    const html = renderToStaticMarkup(<CopyLinkButton resource="https://github.com/atom/atom" />);
    expect(html).toContain('<button type="button"');
    expect(html).toContain("Copy link");
    expect(html).toContain('aria-describedby="copy-link-status"');
    expect(html).toContain('<p id="copy-link-status" role="status"');
  });
  it("shows copy messages as text", () => {
    expect(renderToStaticMarkup(<CopyStatus message="Link copied." />)).toContain("Link copied.");
  });
});
