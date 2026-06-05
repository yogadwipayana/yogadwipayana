"use client";

import { useMemo, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import { copyToClipboard } from "@/lib/utils";

export type PublicMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function highlight(code: string, lang?: string): string {
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch {
    return code;
  }
}

function CodeBlock({ lang, code }: { lang?: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => highlight(code, lang), [code, lang]);

  async function handleCopy() {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-white/[0.07] bg-[#0f0f0f]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
          {lang ?? "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed text-white/85">
        <code
          className={`hljs${lang ? ` language-${lang}` : ""}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </pre>
    </div>
  );
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="markdown text-[14px] leading-relaxed text-white/80">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({
            className,
            children,
            ...props
          }: ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const lang = match?.[1];
            const raw = String(children ?? "").replace(/\n$/, "");
            const isBlock = raw.includes("\n") || !!lang;

            if (!isBlock) {
              return (
                <code
                  className="mx-0.5 rounded border border-white/[0.08] bg-white/[0.05] px-1.5 py-0.5 font-mono text-[12px] text-[#3ecf8e]/75"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            if (lang === "mermaid") {
              return <MermaidDiagram code={raw} />;
            }

            return <CodeBlock lang={lang} code={raw} />;
          },
          a({ children, ...props }) {
            return (
              <a
                {...props}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3ecf8e] underline-offset-2 hover:underline"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function Transcript({ messages }: { messages: PublicMessage[] }) {
  return (
    <div className="flex flex-col">
      {messages.map((message, i) => {
        const prev = messages[i - 1];
        const isFirstInGroup = prev?.role !== message.role;
        const spacing = isFirstInGroup ? "mt-5" : "mt-1";

        if (message.role === "user") {
          return (
            <div key={message.id} className={`flex justify-end ${spacing}`}>
              <div className="flex max-w-[80%] flex-col items-end">
                <div className="rounded-2xl rounded-br-md border border-[#3ecf8e]/12 bg-[#3ecf8e]/[0.07] px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-white/90">
                  {message.content}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div key={message.id} className={spacing}>
            <AssistantMarkdown content={message.content} />
          </div>
        );
      })}
    </div>
  );
}
