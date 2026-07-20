import type { Metadata } from "next";

/**
 * Canonical origin. `NEXT_PUBLIC_SITE_URL` wins so local dev and preview
 * deployments stay self-referential; production falls back to the real domain
 * even if the variable is missing, so canonicals never point at localhost.
 */
const FALLBACK_SITE_URL = "https://yogathedev.com";

function resolveSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!configured) return FALLBACK_SITE_URL;

  // NEXT_PUBLIC_* is inlined at build time, so a stray localhost value from a
  // local .env would otherwise ship canonicals and sitemap URLs pointing at the
  // developer's machine. Never let that reach production.
  if (
    process.env.NODE_ENV === "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|$|\/)/.test(configured)
  ) {
    return FALLBACK_SITE_URL;
  }

  return configured;
}

export const SITE_URL = resolveSiteUrl();

export const siteConfig = {
  name: "Yoga",
  author: "Yoga Dwipayana",
  locale: "en_US",
  github: "https://github.com/yogadwipayana",
  description:
    "One OpenAI-compatible key for GPT and Claude, a browser VPS console, chat, and an image studio — built and run in the open by Yoga Dwipayana.",
} as const;

export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

type PageSeo = {
  title: string;
  description: string;
  /** Route path beginning with a slash, e.g. `/tools`. */
  path: string;
  keywords?: string[];
  /** Keep the page out of search results (auth, transactional, private pages). */
  noIndex?: boolean;
};

/**
 * Builds page metadata with a canonical URL and social cards.
 *
 * `openGraph.title` / `twitter.title` are deliberately left unset: Next.js
 * fills them from the resolved `title`, which keeps the root title template
 * applied in one place instead of duplicating it per page.
 */
export function pageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex,
}: PageSeo): Metadata {
  const url = absoluteUrl(path);

  if (noIndex) {
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    };
  }

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
    },
    twitter: { card: "summary_large_image" },
  };
}

/* -------------------------------------------------------------------------- */
/*  Structured data                                                            */
/* -------------------------------------------------------------------------- */

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: siteConfig.name,
    description: siteConfig.description,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#person` },
  };
}

export function personSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/#person`,
    name: siteConfig.author,
    alternateName: siteConfig.name,
    url: SITE_URL,
    jobTitle: "Software Engineer",
    description:
      "Builder shipping AI-powered developer tools: an OpenAI-compatible AI router, a browser VPS console, chat, and an image studio.",
    sameAs: [siteConfig.github],
    knowsAbout: [
      "AI infrastructure",
      "LLM routing",
      "Next.js",
      "TypeScript",
      "Linux server administration",
    ],
  };
}

type SoftwareApp = {
  name: string;
  description: string;
  path: string;
  category?: string;
};

export function softwareApplicationSchema({
  name,
  description,
  path,
  category = "DeveloperApplication",
}: SoftwareApp) {
  return {
    "@type": "SoftwareApplication",
    name,
    description,
    url: absoluteUrl(path),
    applicationCategory: category,
    operatingSystem: "Web",
    author: { "@id": `${SITE_URL}/#person` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free to start, then pay as you go per token.",
    },
  };
}

export function itemListSchema(name: string, items: SoftwareApp[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: softwareApplicationSchema(item),
    })),
  };
}

/** Breadcrumbs for a sub-page. `Home` is prepended automatically. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  const crumbs = [{ name: "Home", path: "/" }, ...trail];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}
