import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";

import { AuthShell } from "@/components/layout/AuthShell";
import { SignInForm } from "./SignInForm";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description:
    "Sign in to Yoga: one login for VPS Control, AI Router, Chat AI, and Image Studio.",
  path: "/sign-in",
  noIndex: true,
});

function FormFallback() {
  return <div className="h-[248px] animate-pulse rounded-md bg-white/[0.02]" />;
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
