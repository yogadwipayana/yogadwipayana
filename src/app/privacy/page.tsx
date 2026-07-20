import type { Metadata } from "next";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PageBackdrop } from "@/components/ui/PageBackdrop";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description:
    "How this site and its tools handle your data: what is collected, where it is stored, who it is shared with, and how to delete it.",
  path: "/privacy",
});

const UPDATED = "June 2026";

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="mt-3 text-[13px] text-white/40">
              Last updated {UPDATED}
            </p>

            <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-white/65">
              <p>
                This site collects only what it needs to run the tools and keep
                your account working. It isn&apos;t in the business of selling
                data.
              </p>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">
                  What&apos;s collected
                </h2>
                <p>
                  Your account email and authentication details, the content you
                  create in the tools (conversations, generated images, instance
                  and key metadata), and basic usage analytics that help keep the
                  site healthy.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">
                  Third-party services
                </h2>
                <p>
                  Authentication and data are handled by Supabase; tool requests
                  may pass through upstream providers (model APIs, cloud
                  infrastructure) to do their work. Each handles data under its
                  own terms.
                </p>
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-medium text-white">Your data</h2>
                <p>
                  You can delete the content you create, and you can request that
                  your account and its data be removed. Some records may persist
                  briefly in backups before aging out.
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
