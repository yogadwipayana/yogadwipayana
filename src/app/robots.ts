import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * Only truly private or per-visitor surfaces are disallowed here.
 *
 * Auth pages (`/sign-in`, `/sign-up`, …) are deliberately crawlable: they each
 * ship `noindex` in their metadata, and Googlebot has to be allowed to fetch a
 * page before it can see that tag. Blocking them in robots.txt is what let
 * "Create your account" surface as a sitelink instead of being dropped.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/chat/share/", "/uploads/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
