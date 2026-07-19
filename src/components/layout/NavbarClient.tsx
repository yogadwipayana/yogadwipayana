"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { Logo } from "@/components/ui/Logo";

type NavItem = {
  href: string;
  label: string;
  external?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tools", label: "Tools" },
  { href: "/ai", label: "AI" },
];

type NavbarClientProps = {
  user: { email: string } | null;
};

export function NavbarClient({ user }: NavbarClientProps) {
  const [open, setOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);
  const close = () => setOpen(false);
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();

  const handleSignOut = () => {
    close();
    startSignOut(async () => {
      await fetch("/auth/sign-out", { method: "POST" });
      router.refresh();
      router.push("/");
    });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#1c1c1c]/80 backdrop-blur-md">
      {bannerVisible && (
        <div className="flex items-center justify-center gap-1 border-b border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-4 py-1.5">
          <a
            href="https://chat.whatsapp.com/BYRIzw7TKRZJlSleNRA91O"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-center text-[13px] text-[#3ecf8e] transition-colors hover:bg-[#3ecf8e]/10"
          >
            <span>
              Join our WhatsApp group and get{" "}
              <span className="font-semibold">$25</span> in free API credits
            </span>
          </a>
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => setBannerVisible(false)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#3ecf8e]/70 transition-colors hover:bg-[#3ecf8e]/15 hover:text-[#3ecf8e]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-8"
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2 justify-self-start text-[15px] font-medium tracking-[-0.01em] text-white"
        >
          <Logo className="h-6 w-6" />
          yoga
        </Link>

        {/* Desktop: centered links */}
        <div className="hidden items-center justify-center gap-1 text-sm text-white/70 sm:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>

        {/* Right slot: auth-aware on desktop, hamburger on mobile */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/console"
            onClick={close}
            className="hidden h-8 items-center rounded-md px-3 text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
          >
            Console
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                onClick={close}
                className="hidden h-8 items-center rounded-md px-3 text-[13px] text-white/70 transition-colors hover:bg-white/5 hover:text-white sm:inline-flex"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="hidden h-8 items-center gap-1.5 rounded-md border border-white/15 bg-transparent px-3 text-[13px] text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.04] hover:text-white disabled:opacity-60 sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}

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
          <NavLink
            item={{ href: "/console", label: "Console" }}
            onNavigate={close}
            mobile
          />

          {user ? (
            <>
              <div className="mt-2 truncate px-3 text-[12px] text-white/40">
                {user.email}
              </div>
              <Link
                href="/dashboard"
                onClick={close}
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 bg-transparent px-4 text-sm font-medium text-white transition-colors hover:border-white/30 hover:bg-white/[0.04]"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-white/[0.04] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.08] disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
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
