import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";

import { PostHogProvider } from "@/components/analytics/PostHogProvider";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL
    ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
    : undefined,
  title: {
    default: "Yoga Dwipayana",
    template: "%s · Yoga Dwipayana",
  },
  description:
    "Personal portfolio and working hub of Yoga Dwipayana — a polyagentmorous builder shipping AI-powered developer tools from Bali.",
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
