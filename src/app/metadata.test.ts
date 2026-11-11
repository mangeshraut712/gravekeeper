import { describe, expect, it } from "vitest";
import { metadata, viewport } from "./layout";
import robots from "./robots";
import sitemap from "./sitemap";
import * as og from "./opengraph-image";
import * as twitter from "./twitter-image";
import { metadata as restorationMetadata } from "./restoration/page";
import { metadata as lanternMetadata } from "./lantern-hill/page";
import { metadata as proofMetadata } from "./proof/page";
import { siteUrl, themeColor } from "@/shared/site";

describe("site metadata", () => {
  it("sets a base URL, canonical, description and large Twitter card", () => {
    expect(String(metadata.metadataBase)).toBe(`${siteUrl}/`);
    expect(metadata.alternates?.canonical).toBe("/");
    expect(metadata.description).toMatch(/archive snapshots/);
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses the page background as theme colour", () => {
    expect(viewport.themeColor).toBe(themeColor);
    expect(themeColor).toBe("#111510");
  });

  it("gives each demo page its own canonical and description", () => {
    expect(restorationMetadata.alternates?.canonical).toBe("/restoration");
    expect(lanternMetadata.alternates?.canonical).toBe("/lantern-hill");
    expect(restorationMetadata.description).toBeTruthy();
    expect(lanternMetadata.description).toBeTruthy();
  });

  it("gives /proof its own canonical (the root one points at the home page, which Lighthouse flags)", () => {
    expect(proofMetadata.alternates?.canonical).toBe("/proof");
  });

  it("overrides the root Twitter card text on demo pages (metadata merges shallowly)", () => {
    for (const page of [restorationMetadata, lanternMetadata]) {
      expect(page.twitter).toMatchObject({
        card: "summary_large_image",
        title: page.title,
        description: page.description,
      });
    }
  });

  it("keeps the share image on demo pages that override openGraph and twitter", () => {
    for (const page of [restorationMetadata, lanternMetadata]) {
      expect(page.openGraph?.images).toMatchObject([
        { url: "/opengraph-image", width: 1200, height: 630, type: "image/png" },
      ]);
      expect(page.twitter?.images).toMatchObject([
        { url: "/twitter-image", width: 1200, height: 630, type: "image/png" },
      ]);
    }
  });

  it("declares 1200x630 PNG share images with alt text", () => {
    for (const image of [og, twitter]) {
      expect(image.size).toEqual({ width: 1200, height: 630 });
      expect(image.contentType).toBe("image/png");
      expect(image.alt.length).toBeGreaterThan(10);
    }
  });

  it("allows pages but not API or raw fixture routes, and lists the sitemap", () => {
    const r = robots();
    expect(r.rules).toMatchObject({ allow: "/", disallow: ["/api/", "/fixtures/"] });
    expect(r.sitemap).toBe(`${siteUrl}/sitemap.xml`);
    expect(sitemap().map((entry) => entry.url)).toEqual([
      siteUrl,
      `${siteUrl}/restoration`,
      `${siteUrl}/lantern-hill`,
    ]);
  });
});
