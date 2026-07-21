import type { Metadata } from "next";

import { SmsLayoutShell } from "./shell-client";

export const metadata: Metadata = {
  title: "SMS OTP · Dashboard",
  description:
    "Rent a disposable phone number and receive the OpenAI verification code for Codex.",
};

export default function SmsLayout({ children }: { children: React.ReactNode }) {
  return <SmsLayoutShell>{children}</SmsLayoutShell>;
}
