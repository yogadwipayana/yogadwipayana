import type { Metadata } from "next";

import { DashboardShell } from "../shell";

export const metadata: Metadata = {
  title: "VPS Control · Dashboard",
  description: "Manage your VPS instances — monitor, start, stop, and configure.",
};

export default function VpsPage() {
  return <DashboardShell toolId="vps" />;
}
