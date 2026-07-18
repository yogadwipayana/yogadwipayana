import type { Metadata } from "next";

import { Navbar } from "@/components/layout/Navbar";

import ConsoleClient from "./console-client";

export const metadata: Metadata = {
  title: "Console",
  description:
    "Monitor requests, tokens, budget, and expiry for a temporary API key.",
};

export default function ConsolePage() {
  return (
    <>
      <Navbar />
      <ConsoleClient />
    </>
  );
}
