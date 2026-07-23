import Link from "next/link";

import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { label: "Tools", href: "/tools" },
  { label: "AI", href: "/store" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <Logo className="h-5 w-5" />
            <span className="font-medium text-white">Yoga</span>
          </Link>
          <span className="text-white/35" suppressHydrationWarning>
            © {new Date().getFullYear()} All rights reserved.
          </span>
        </div>

        <nav aria-label="Footer" className="flex items-center gap-5">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-white/50 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
