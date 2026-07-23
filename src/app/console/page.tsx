import type { Metadata } from "next";

import { Navbar } from "@/components/layout/Navbar";
import { pageMetadata } from "@/lib/seo";

import ConsoleClient from "./console-client";

// Per-visitor key data — nothing here is meaningful in a search result.
export const metadata: Metadata = pageMetadata({
  title: "Console",
  description:
    "Monitor requests, tokens, budget, and expiry for a temporary API key.",
  path: "/console",
  noIndex: true,
});

export default function ConsolePage() {
  return (
    <>
      <Navbar />
      <ConsoleClient />
    </>
  );
}
