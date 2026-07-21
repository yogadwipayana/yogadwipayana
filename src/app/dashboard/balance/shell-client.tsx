"use client";

import { DashboardShell } from "../shell";

export function BalanceLayoutShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell toolId="balance">{children}</DashboardShell>;
}
