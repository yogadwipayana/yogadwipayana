import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

import { EmailPasswordSignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign up",
  description:
    "Create an account to open the dashboard — the working surface where VPS Control, AI Router, and Chat AI live together.",
};

export default function SignUpPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10 sm:py-12">
        <BackgroundGlow />
        <AuthCard />
      </main>

      <Footer />
    </div>
  );
}

function BackgroundGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#3ecf8e]/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />
    </>
  );
}

function AuthCard() {
  return (
    <section className="relative z-10 w-full max-w-[440px]">
      <div className="rounded-2xl border border-white/[0.08] bg-[#171717] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.45)] sm:p-6">
        <div className="mb-5 text-center">
          <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] sm:text-[32px]">
            Create your account
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            Email and password — confirm your inbox to finish.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-white/15 bg-white/[0.03] px-4 text-[14px] font-medium text-white opacity-70 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
            <ComingSoonBadge />
          </button>

          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Coming soon"
            className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-white/15 bg-white/[0.03] px-4 text-[14px] font-medium text-white opacity-70 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
          >
            <GithubIcon className="h-5 w-5" />
            Continue with GitHub
            <ComingSoonBadge />
          </button>
        </div>

        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-white/40">
          <span className="h-px flex-1 bg-white/[0.08]" />
          or with email
          <span className="h-px flex-1 bg-white/[0.08]" />
        </div>

        <EmailPasswordSignUpForm />

        <div className="mt-5 border-t border-white/[0.06] pt-4 text-center text-[13px] text-white/55">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-white underline-offset-4 transition-colors hover:text-[#3ecf8e] hover:underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}

function ComingSoonBadge() {
  return (
    <span className="ml-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-white/55">
      Coming soon
    </span>
  );
}

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.17c-3.34.72-4.04-1.42-4.04-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.95 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.4 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.6l6.2 5.2C41.3 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
