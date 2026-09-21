"use client";

import { createContext, useContext } from "react";

export type DashboardUser = {
  email: string | null;
  displayName: string | null;
};

const DashboardUserContext = createContext<DashboardUser | null>(null);

/**
 * Hands the signed-in user (resolved once in the dashboard layout) to client
 * components deep inside the shell, such as the account menu, without
 * threading props through every tool's layout.
 */
export function DashboardUserProvider({
  user,
  children,
}: {
  user: DashboardUser | null;
  children: React.ReactNode;
}) {
  return <DashboardUserContext value={user}>{children}</DashboardUserContext>;
}

export function useDashboardUser(): DashboardUser | null {
  return useContext(DashboardUserContext);
}
