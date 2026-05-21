import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <Navbar />

      <main className="relative flex flex-1 items-center overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[#3ecf8e]/10 blur-[120px]"
        />

        <div className="relative mx-auto w-full max-w-6xl px-6 py-20 sm:px-8 sm:py-28">
          <div className="flex max-w-xl flex-col gap-7">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/80">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
              404 · Page not found
            </span>

            <div className="flex flex-col gap-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
                /404
              </p>
              <h1 className="text-[44px] font-medium leading-[1.02] tracking-[-0.035em] sm:text-[60px] md:text-[68px]">
                Lost in the
                <br />
                <span className="text-white/45">routing table.</span>
              </h1>
            </div>

            <p className="text-[17px] leading-[1.65] text-white/65">
              The page you&apos;re after doesn&apos;t exist, has moved, or was never here
              to begin with. No harm done — pick a direction below.
            </p>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/">
                  Back home
                  <ArrowUpRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="secondary" size="lg">
                <Link href="/tools">
                  <Compass aria-hidden />
                  Browse tools
                </Link>
              </Button>
            </div>

            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.08] pt-6 text-[13px] text-white/50">
              <span className="text-white/40">Try one of these instead:</span>
              <Link href="/about" className="transition-colors hover:text-[#3ecf8e]">
                About
              </Link>
              <Link href="/tools" className="transition-colors hover:text-[#3ecf8e]">
                Tools
              </Link>
              <Link href="/dashboard" className="transition-colors hover:text-[#3ecf8e]">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
