import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { createClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
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
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-white"
          >
            <Logo className="h-7 w-7" />
            yoga
          </Link>
          <h1 className="mt-6 text-2xl font-medium tracking-[-0.01em] text-white">
            {user ? "Set a new password" : "Reset link expired"}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            {user
              ? "Choose a strong password you don't use anywhere else."
              : "This password reset link is invalid or has expired."}
          </p>
        </div>

        <div className="mt-8">
          {user ? (
            <ResetPasswordForm />
          ) : (
            <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 text-center sm:p-8">
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
        </div>

        <p className="mt-6 text-center text-[13px] text-white/50">
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
