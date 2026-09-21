import type { Metadata } from "next";

import { getCurrentUser, readDisplayName } from "@/lib/server/current-user";

import { DashboardUserProvider } from "./user-context";

/**
 * Every dashboard route is behind auth and personal to the signed-in user.
 * Child segments override title and description but inherit these robots
 * directives, so nothing under /dashboard can be indexed by accident.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <DashboardUserProvider
      user={
        user
          ? {
              email: user.email ?? null,
              displayName: readDisplayName(user) || null,
            }
          : null
      }
    >
      {children}
    </DashboardUserProvider>
  );
}
