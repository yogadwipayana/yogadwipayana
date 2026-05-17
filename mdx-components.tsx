import type { MDXComponents } from "mdx/types";

/**
 * Customize how MDX content is rendered across the site.
 * Add tag overrides here (e.g. h1, a, code) without restyling each post.
 */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-10 mb-6 text-[32px] font-medium tracking-[-0.02em] text-white">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-10 mb-4 text-[22px] font-medium tracking-[-0.01em] text-white">
        {children}
      </h2>
    ),
    p: ({ children }) => (
      <p className="my-4 leading-relaxed text-white/75">{children}</p>
    ),
    a: ({ href = "#", children }) => (
      <a
        href={href}
        className="text-[#3ecf8e] underline-offset-4 hover:underline"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.9em] text-white/90">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="my-5 overflow-x-auto rounded-md border border-white/[0.08] bg-[#171717] p-4 text-[13px] leading-relaxed">
        {children}
      </pre>
    ),
    ul: ({ children }) => (
      <ul className="my-4 list-disc pl-6 text-white/75 marker:text-white/40">
        {children}
      </ul>
    ),
    ...components,
  };
}
