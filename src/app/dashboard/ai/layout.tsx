"use client";

import { DashboardShell } from "../shell";

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell toolId="ai">{children}</DashboardShell>;
}
