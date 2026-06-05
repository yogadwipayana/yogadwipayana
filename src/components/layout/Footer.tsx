import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 text-sm text-white/50 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-[#3ecf8e]"
          />
          <span>© {new Date().getFullYear()} Yoga · Bali, ID</span>
        </div>
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
          <Link href="/about" className="transition-colors hover:text-white">
            About
          </Link>
        </div>
      </div>
    </footer>
  );
}
