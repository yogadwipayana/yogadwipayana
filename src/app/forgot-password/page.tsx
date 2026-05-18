import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  description: "Reset the password on your yoga dashboard account.",
};

export default function ForgotPasswordPage() {
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
                Reset your password
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">
                We&rsquo;ll email you a link to set a new password.
              </p>
            </div>

            <ForgotPasswordForm />

            <div className="mt-6 border-t border-white/[0.06] pt-5 text-center text-[13px] text-white/55">
              Remembered it?{" "}
              <Link
                href="/sign-in"
                className="font-medium text-white underline-offset-4 transition-colors hover:text-[#3ecf8e] hover:underline"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
