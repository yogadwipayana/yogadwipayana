import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/seo";

/**
 * Public, indexable routes only. Auth, dashboard, share tokens, and the
 * temporary key console are intentionally excluded — they are either private
 * or per-visitor and carry no search value.
 *
 * `lastModified` is a fixed date per route, not `new Date()`: a timestamp that
 * moves on every crawl tells Google the page changed when it did not, which is
 * how a stale "2 days ago" ends up printed in front of the search snippet.
 * Bump the date on a route when its content actually changes.
 */
const ROUTES: {
  path: string;
  lastModified: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  { path: "/", lastModified: "2026-08-23", priority: 1, changeFrequency: "weekly" },
  { path: "/tools", lastModified: "2026-08-23", priority: 0.9, changeFrequency: "weekly" },
  { path: "/store", lastModified: "2026-08-23", priority: 0.9, changeFrequency: "weekly" },
  { path: "/ai", lastModified: "2026-08-23", priority: 0.8, changeFrequency: "weekly" },
  { path: "/privacy", lastModified: "2026-06-01", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", lastModified: "2026-06-01", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
