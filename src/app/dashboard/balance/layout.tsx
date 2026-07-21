import type { Metadata } from "next";

import { BalanceLayoutShell } from "./shell-client";

export const metadata: Metadata = {
  title: "Balance · Dashboard",
  description:
    "Your prepaid balance: redeem a voucher, track top-ups, and see what each tool has spent.",
};

export default function BalanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <BalanceLayoutShell>{children}</BalanceLayoutShell>;
}
