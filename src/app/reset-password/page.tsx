import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { createClient } from "@/utils/supabase/server";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Set a new password for your Yoga account.",
};

export default async function ResetPasswordPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell
      title={user ? "Set a new password" : "Reset link expired"}
      subtitle={
        user
          ? "Choose a strong password you don't use anywhere else."
          : "This password reset link is invalid or has expired."
      }
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
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="text-center">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50"
          >
            <AlertCircle className="h-5 w-5" />
          </span>
          <p className="mt-4 text-[14px] leading-relaxed text-white/55">
            Request a fresh link and we&apos;ll email you a new one.
          </p>
          <div className="mt-6">
            <Button className="w-full" asChild>
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
