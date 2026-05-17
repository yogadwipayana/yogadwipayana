"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tools", label: "Tools" },
  { href: "https://github.com/yogadwipayana", label: "GitHub", external: true },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#1c1c1c]/80 backdrop-blur-md">
      <nav
        aria-label="Primary"
        className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-6 sm:px-8"
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em]"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[#3ecf8e] shadow-[0_0_12px_#3ecf8e]"
          />
          yoga
        </Link>

        {/* Desktop: centered links */}
        <div className="hidden items-center justify-center gap-1 text-sm text-white/70 sm:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Right slot: Sign in / Sign up on desktop, hamburger on mobile */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/sign-in"
            onClick={close}
            className="hidden h-8 items-center rounded-md px-3 text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={close}
            className="hidden h-8 items-center rounded-md bg-[#3ecf8e] px-3.5 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] sm:inline-flex"
          >
            Sign up
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white sm:hidden"
          >
            {open ? (
              <X className="h-4 w-4" aria-hidden />
            ) : (
              <Menu className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      <div
        id="mobile-menu"
        hidden={!open}
        className="border-t border-white/[0.08] bg-[#1c1c1c] sm:hidden"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} onNavigate={close} mobile />
          ))}
          <Link
            href="/sign-in"
            onClick={close}
            className="mt-2 inline-flex h-10 items-center justify-center rounded-md border border-white/15 bg-transparent px-4 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            onClick={close}
            className="inline-flex h-10 items-center justify-center rounded-md bg-[#3ecf8e] px-4 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function NavLink({
  item,
  mobile,
  onNavigate,
}: {
  item: NavItem;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const base = mobile
    ? "flex h-10 items-center rounded-md px-3 text-[15px] text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
    : "inline-flex h-8 items-center rounded-md px-3 transition-colors hover:bg-white/5 hover:text-white";

  const externalProps = item.external
    ? { target: "_blank", rel: "noopener noreferrer" as const }
    : {};

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={base}
      {...externalProps}
    >
      {item.label}
    </Link>
  );
}
