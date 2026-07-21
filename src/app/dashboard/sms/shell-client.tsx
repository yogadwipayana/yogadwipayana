"use client";

import { DashboardShell } from "../shell";

export function SmsLayoutShell({ children }: { children: React.ReactNode }) {
  return <DashboardShell toolId="sms">{children}</DashboardShell>;
}
