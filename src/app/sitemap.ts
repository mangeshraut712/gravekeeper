import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/restoration", "/lantern-hill"].map((path) => ({
    url: path === "/" ? siteUrl : `${siteUrl}${path}`,
  }));
}
