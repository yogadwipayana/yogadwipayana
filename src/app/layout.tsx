import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";

import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import { SITE_URL, siteConfig } from "@/lib/seo";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Yoga | AI Router, Chat, VPS & Image tools in one hub",
    template: "%s · Yoga",
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.author, url: SITE_URL }],
  creator: siteConfig.author,
  publisher: siteConfig.author,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: siteConfig.name,
    locale: siteConfig.locale,
  },
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Stops phone numbers, dates, and addresses being auto-linked on iOS.
  formatDetection: { telephone: false, date: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#1c1c1c",
  colorScheme: "dark",
};

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-[#1c1c1c] text-white"
        suppressHydrationWarning
      >
        <PostHogProvider>{children}</PostHogProvider>
        {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
      </body>
    </html>
  );
}
