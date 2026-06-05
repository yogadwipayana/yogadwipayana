import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { SignInForm } from "./SignInForm";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Yoga — one login for VPS Control, AI Router, Chat AI, and Image Studio.",
};

function FormFallback() {
  return (
    <div className="h-[268px] rounded-lg border border-white/[0.08] bg-[#171717]" />
  );
}

export default function SignInPage() {
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
            Welcome back
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            Sign in to pick up where you left off.
          </p>
        </div>

        <div className="mt-8">
          <Suspense fallback={<FormFallback />}>
            <SignInForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-[13px] text-white/50">
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
