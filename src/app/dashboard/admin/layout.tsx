"use client";

import { usePathname } from "next/navigation";
import { DashboardShell } from "../shell";

const PATH_TO_ITEM_ID: Record<string, string> = {
  "/dashboard/admin/og": "admin:og",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initialActiveId = PATH_TO_ITEM_ID[pathname] ?? "admin:og";

  return (
    <DashboardShell toolId="settings" initialActiveId={initialActiveId}>
      {children}
    </DashboardShell>
  );
}
