"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { MessageRow } from "@/lib/server/chat-service";
import { MermaidDiagram } from "@/components/ui/MermaidDiagram";

type Props = {
  title: string;
  model: string;
  updatedAt: string;
  messages: Pick<MessageRow, "id" | "role" | "content">[];
};

export function ShareView({ title, model, updatedAt, messages }: Props) {
  const formatted = new Date(updatedAt).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-white/[0.08] pb-6">
        <h1 className="text-2xl font-medium tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        <p className="font-mono text-xs text-white/40">
          {model} · {formatted}
        </p>
      </div>

      {/* Messages */}
      <ol className="flex flex-col gap-4">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <li key={msg.id} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-[#3ecf8e]/15 px-4 py-3 text-sm leading-relaxed text-white ring-1 ring-[#3ecf8e]/20">
                <Prose content={msg.content} />
              </div>
            </li>
          ) : (
            <li key={msg.id} className="flex justify-start">
              <div className="w-full rounded-2xl rounded-tl-sm bg-white/[0.04] px-4 py-3 text-sm leading-relaxed text-white/90 ring-1 ring-white/[0.08]">
                <Prose content={msg.content} />
              </div>
            </li>
          ),
        )}
      </ol>

      {/* Footer */}
      <footer className="mt-4 border-t border-white/[0.08] pt-5 text-center font-mono text-xs text-white/30">
        Read-only — shared via{" "}
        <a
          href="/"
          className="text-[#3ecf8e] transition-colors hover:text-[#24b47e]"
        >
          Yoga Dwipayana Chat
        </a>
      </footer>
    </div>
  );
}

function Prose({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3ecf8e] underline underline-offset-2 hover:text-[#24b47e]"
          >
            {children}
          </a>
        ),
        code: ({ children, className }) => {
          const langMatch = /language-(\w+)/.exec(className || "");
          const lang = langMatch?.[1] ?? null;
          if (lang === "mermaid") {
            return <MermaidDiagram code={String(children).replace(/\n$/, "")} />;
          }
          const isBlock = !!langMatch;
          return isBlock ? (
            <code className="block overflow-x-auto rounded-md bg-white/[0.06] px-3 py-2 font-mono text-xs text-white/80">
              {children}
            </code>
          ) : (
            <code className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-xs text-white/80">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md bg-white/[0.06] p-3 font-mono text-xs text-white/80">
            {children}
          </pre>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="mb-2 list-disc pl-5 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-2 list-decimal pl-5 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-0.5">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-[#3ecf8e]/40 pl-3 text-white/60">
            {children}
          </blockquote>
        ),
        h1: ({ children }) => (
          <h1 className="mb-2 text-lg font-semibold text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 text-base font-semibold text-white">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1.5 text-sm font-semibold text-white">{children}</h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
