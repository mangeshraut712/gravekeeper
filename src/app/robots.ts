import type { MetadataRoute } from "next";
import { siteUrl } from "@/shared/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/fixtures/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
