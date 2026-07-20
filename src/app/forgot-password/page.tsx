import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/layout/AuthShell";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Forgot password",
  description: "Reset your Yoga account password.",
  path: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we'll send you a link to set a new one."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
