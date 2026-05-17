import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { getPostMeta, getPostSlugs } from "@/lib/posts";

interface Params {
  slug: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  return getPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getPostMeta(slug);
  if (!meta) return { title: "Not found" };
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const meta = getPostMeta(slug);
  if (!meta) notFound();

  // Dynamic import lets Next/MDX compile the file and tree-shake unused posts.
  const Post = (await import(`@/content/posts/${slug}.mdx`)).default;

  return (
    <div className="flex flex-1 flex-col bg-[#1c1c1c] text-white">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-24">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-[13px] text-white/55 transition-colors hover:text-white"
        >
          ← Back to blog
        </Link>
        <article>
          <header className="mb-8 border-b border-white/[0.06] pb-6">
            <time className="font-mono text-[12px] text-white/40">
              {formatDate(meta.date)}
            </time>
            <h1 className="mt-2 text-[36px] font-medium leading-tight tracking-[-0.02em] sm:text-[44px]">
              {meta.title}
            </h1>
            {meta.description ? (
              <p className="mt-3 text-[15px] leading-relaxed text-white/60">
                {meta.description}
              </p>
            ) : null}
          </header>
          <Post />
        </article>
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
