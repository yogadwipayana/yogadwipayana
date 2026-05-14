import type { Metadata } from "next";

import { DashboardShell } from "./shell";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Authenticated workspace that hosts every tool in one place — VPS Control, AI Router, and Chat AI.",
};

export default function DashboardPage() {
  return <DashboardShell />;
}
