import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Account confirmed",
  description: "Your Yoga account is confirmed. Sign in to access the hub.",
};

export default function ConfirmedPage() {
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
        </div>

        <div className="mt-8 rounded-lg border border-white/[0.08] bg-[#171717] p-6 text-center sm:p-8">
          <span
            aria-hidden
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
          >
            <CheckCircle2 className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-lg font-medium text-white">
            Account confirmed
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-white/55">
            Your account is registered. You can sign in now to access the hub.
          </p>
          <div className="mt-6">
            <Button size="lg" className="w-full" asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
