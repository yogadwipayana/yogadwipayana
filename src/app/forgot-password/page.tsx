import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset your Yoga account password.",
};

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em] text-white"
          >
            <span
              aria-hidden
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/[0.04]"
            >
              <Logo className="h-[18px] w-[18px]" />
            </span>
            yoga
          </Link>
          <h1 className="mt-6 text-2xl font-medium tracking-[-0.01em] text-white">
            Reset your password
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            Enter your email and we&apos;ll send you a link to set a new one.
          </p>
        </div>

        <div className="mt-8">
          <ForgotPasswordForm />
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
