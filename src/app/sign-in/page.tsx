import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/layout/AuthShell";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to Yoga: one login for VPS Control, AI Router, Chat AI, and Image Studio.",
};

function FormFallback() {
  return (
    <div className="h-[268px] rounded-lg border border-white/[0.08] bg-[#171717]" />
  );
}

export default function SignInPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/sign-up"
            className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
          >
            Sign up
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormFallback />}>
        <SignInForm />
      </Suspense>
    </AuthShell>
  );
}
