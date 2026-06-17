import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { NotFoundTerminal } from "./not-found-terminal";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="flex min-h-[60vh] items-center">
          <div className="mx-auto w-full max-w-3xl px-6 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-col items-start gap-8">
              <div className="flex flex-col gap-4">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-xs font-medium text-[#3ecf8e]">
                  404
                </span>
                <h1 className="text-3xl font-medium leading-[1.1] tracking-[-0.02em] text-white text-balance sm:text-4xl">
                  Page not found
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-white/60 text-pretty">
                  That route doesn&apos;t resolve to anything. The page may have
                  moved, or the address might be off.
                </p>
              </div>

              <NotFoundTerminal />

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/">Back home</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/tools">Browse tools</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
