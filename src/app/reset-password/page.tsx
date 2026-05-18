import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { createClient } from "@/utils/supabase/server";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your account.",
};

export default async function ResetPasswordPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Recovery sets a session via /auth/confirm. Without one, the link is invalid or expired.
  if (!user) {
    redirect("/forgot-password?error=expired");
  }

  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#3ecf8e]/10 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
        />

        <section className="relative z-10 w-full max-w-[440px]">
          <div className="mb-6 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[14px] font-medium tracking-[-0.01em] text-white/80 transition-colors hover:text-white"
            >
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[#3ecf8e] shadow-[0_0_12px_#3ecf8e]"
              />
              yoga
            </Link>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-[24px] font-medium leading-tight tracking-[-0.02em] sm:text-[28px]">
                Set a new password
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                You&rsquo;ll be signed in automatically once you save it.
              </p>
            </div>

            <ResetPasswordForm />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
