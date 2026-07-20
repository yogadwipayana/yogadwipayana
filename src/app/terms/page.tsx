import type { Metadata } from "next";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageBackdrop } from "@/components/ui/PageBackdrop";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description:
    "The terms of use for Yoga's tools and this site: account rules, billing and credits, acceptable use, and liability.",
  path: "/terms",
});

const UPDATED = "June 2026";

export default function TermsPage() {
  return (
    <>
      <PageBackdrop />
      <Navbar />

      <main className="flex-1">
        <section>
          <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-20 sm:px-8 sm:pt-14 sm:pb-28">
            <div className="flex items-center gap-2 text-[13px] text-white/50">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
              />
              Legal
            </div>

            <h1 className="mt-6 text-3xl font-medium tracking-[-0.02em] text-white sm:text-4xl">
              Terms of Use
            </h1>
            <p className="mt-3 text-[13px] text-white/40">
              Last updated {UPDATED}
            </p>

            <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-white/65">
              <p>
                This is a personal site and a hub for a small set of tools built
                and run by Yoga. By creating an account you agree to
                use it reasonably and lawfully. It&apos;s provided as-is, without
                warranty, and may change or go offline at any time.
              </p>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">Your account</h2>
                <p>
                  You&apos;re responsible for keeping your login secure and for
                  activity under your account. Don&apos;t use the tools to break
                  the law, abuse third-party services, or disrupt the platform.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">
                  Usage and billing
                </h2>
                <p>
                  Some tools draw on paid upstream services and are billed pay
                  as you go from your credit balance. You&apos;re responsible for
                  the usage you generate through your keys and sessions.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">Changes</h2>
                <p>
                  These terms may be updated as the tools evolve. Continued use
                  after a change means you accept the revised terms.
                </p>
              </div>

              <p className="text-[13px] text-white/40">
                This is placeholder copy, not formal legal advice. Reach out via
                the links in the footer with any questions.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
