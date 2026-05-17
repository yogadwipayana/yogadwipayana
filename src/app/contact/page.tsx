import type { Metadata } from "next";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch — messages route to my inbox via Resend.",
};

export default function ContactPage() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16 sm:py-24">
        <header className="mb-10">
          <h1 className="text-[36px] font-medium leading-tight tracking-[-0.02em] sm:text-[44px]">
            Say hello
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/60">
            Pitch, partnership, or just want to chat. I read everything.
          </p>
        </header>
        <ContactForm />
      </main>
      <Footer />
    </div>
  );
}
