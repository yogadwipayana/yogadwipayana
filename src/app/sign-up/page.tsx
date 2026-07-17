import type { Metadata } from "next";
import Link from "next/link";

import { AuthShell } from "@/components/layout/AuthShell";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create your Yoga account: one login for VPS Control, AI Router, Chat AI, and Image Studio.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="One login for every tool in the hub."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
          >
            Sign in
          </Link>
        </>
      }
    >
      <SignUpForm />
    </AuthShell>
  );
}
