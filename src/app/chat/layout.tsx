import Link from "next/link";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#1c1c1c] text-white selection:bg-[#3ecf8e]/30 selection:text-white">
      <header className="border-b border-white/[0.08] bg-[#171717]">
        <div className="mx-auto flex w-full max-w-4xl items-center px-6 py-4 sm:px-8">
          <Link
            href="/"
            className="font-mono text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            yoga<span className="text-[#3ecf8e]">.</span>dev
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
