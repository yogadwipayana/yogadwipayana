"use client";

import { usePathname } from "next/navigation";

import { DashboardShell } from "../shell";

const PATH_TO_ITEM_ID: Record<string, string> = {
  "/dashboard/settings/account": "settings:account",
  "/dashboard/settings/security": "settings:security",
  "/dashboard/settings/danger": "settings:danger",
  "/dashboard/admin/og": "admin:og",
};

export function SettingsShellClient({
  children,
  showAdminNav,
}: {
  children: React.ReactNode;
  showAdminNav: boolean;
}) {
  const pathname = usePathname();
  const initialActiveId = PATH_TO_ITEM_ID[pathname] ?? "settings:account";

  return (
    <DashboardShell
      toolId="settings"
      initialActiveId={initialActiveId}
      showAdminNav={showAdminNav}
    >
      {children}
    </DashboardShell>
  );
}
