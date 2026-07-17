import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-white/50 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-2">
          <span suppressHydrationWarning>© {new Date().getFullYear()} Yoga, Bali, ID</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
