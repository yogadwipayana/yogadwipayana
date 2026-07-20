import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * Public, indexable routes only. Auth, dashboard, share tokens, and the
 * temporary key console are intentionally excluded — they are either private
 * or per-visitor and carry no search value.
 */
const ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/tools", priority: 0.9, changeFrequency: "weekly" },
  { path: "/ai", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
