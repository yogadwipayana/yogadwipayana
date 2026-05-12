import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MessageSquare, Server, Waypoints } from "lucide-react";

export const metadata: Metadata = {
  title: "Yoga Dwipayana — Polyagentmorous Builder",
  description:
    "Personal portfolio and workspace of Yoga Dwipayana. Building AI-powered developer tools from Bali, Indonesia.",
};

const tools = [
  {
    href: "/vps",
    title: "VPS Control",
    body: "Spin up, monitor, and wind down instances from a single console.",
    icon: Server,
  },
  {
    href: "/ai",
    title: "AI Router",
    body: "Route prompts across providers and models behind a single key.",
    icon: Waypoints,
  },
  {
    href: "/chat",
    title: "Chat AI",
    body: "A quiet conversational workspace with context and history.",
    icon: MessageSquare,
  },
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white">
      <SiteHeader />

      <main className="flex-1">
        <Hero />
        <ToolsPreview />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1c1c1c]/80 backdrop-blur">
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em]"
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full bg-[#3ecf8e]"
          />
          yoga
        </Link>

        <div className="hidden items-center gap-8 text-sm text-white/70 sm:flex">
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
          <Link href="/tools" className="transition-colors hover:text-white">
            Tools
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            Dashboard
          </Link>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e] sm:hidden"
        >
          Dashboard
        </Link>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-16 pb-20 sm:px-8 sm:pt-24 md:pt-32 md:pb-28">
      <div className="flex flex-col gap-7 sm:gap-8">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
          Based in Bali · Building in public
        </span>

        <h1 className="max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-0.04em] sm:text-5xl md:text-6xl lg:text-7xl">
          Portfolio, playground, and
          <br className="hidden sm:block" /> control room for my tools.
        </h1>

        <p className="max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
          I&rsquo;m Yoga Dwipayana — a polyagentmorous builder shipping
          AI-powered developer tools from Bali. This site is both a portfolio
          and the hub where I run them.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/tools"
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#3ecf8e] px-5 text-sm font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            Explore tools
            <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href="/about"
            className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-transparent px-5 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            About me
          </Link>
        </div>
      </div>
    </section>
  );
}

function ToolsPreview() {
  return (
    <section className="border-t border-white/10 bg-[#171717]">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-8 sm:py-20">
        <div className="mb-10 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.02em] sm:text-3xl">
              Tools
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/60 sm:text-base">
              Three focused utilities. Try them in public or run them together
              inside the dashboard.
            </p>
          </div>
          <Link
            href="/tools"
            className="hidden shrink-0 text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline sm:inline"
          >
            See all →
          </Link>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map(({ href, title, body, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full flex-col gap-5 rounded-xl border border-white/10 bg-[#1c1c1c] p-6 transition-colors hover:border-white/20 hover:bg-[#202020]"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/80">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 text-white/40 transition-colors group-hover:text-white"
                    aria-hidden
                  />
                </div>
                <div>
                  <h3 className="text-base font-medium tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {body}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/tools"
          className="mt-8 inline-flex text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline sm:hidden"
        >
          See all →
        </Link>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm text-white/50 sm:flex-row sm:items-center sm:px-8">
        <p>© {new Date().getFullYear()} Yoga Dwipayana</p>
        <div className="flex items-center gap-5">
          <a
            href="https://github.com/yogadwipayana"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/yoga-dwipayana-9958a1324/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
