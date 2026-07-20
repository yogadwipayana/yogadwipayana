import type { Metadata } from "next";

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
