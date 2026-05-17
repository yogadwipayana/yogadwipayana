import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  title: "Blog",
  description: "Writing on builds, architecture, and the gotchas in between.",
};

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-24">
        <header className="mb-12">
          <h1 className="text-[36px] font-medium leading-tight tracking-[-0.02em] sm:text-[44px]">
            Blog
          </h1>
          <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-white/60">
            Working notes on what I&rsquo;m building and how the pieces fit
            together.
          </p>
        </header>

        {posts.length === 0 ? (
          <p className="text-white/60">No posts yet. Check back soon.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.06]">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-1 py-5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-[18px] font-medium tracking-[-0.01em] text-white group-hover:text-[#3ecf8e]">
                      {post.title}
                    </h2>
                    <time className="shrink-0 font-mono text-[12px] text-white/40">
                      {formatDate(post.date)}
                    </time>
                  </div>
                  <p className="text-[14px] leading-relaxed text-white/55">
                    {post.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
