"use client";

import { useMemo, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import hljs from "highlight.js/lib/common";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

import { MermaidDiagram } from "@/components/ui/MermaidDiagram";
import { GraphvizDiagram } from "@/components/ui/GraphvizDiagram";
import { copyToClipboard, normalizeMarkdownLists } from "@/lib/utils";

export type PublicToolEvent = {
  call_id: string;
  name: string;
  status: "running" | "done";
  args?: unknown;
  result?: unknown;
};

export type PublicMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolEvents?: PublicToolEvent[];
  followUps?: string[];
};

/** Human-readable label for a tool name (matches the dashboard renderer). */
function toolLabel(name: string): string {
  const map: Record<string, string> = {
    web_search: "Web search",
    web_fetch: "Fetched a page",
    image_generate: "Generated an image",
    image_edit: "Edited an image",
    generate_docx: "Generated a document",
    open_terminal: "Opened a terminal",
    terminal_run: "Ran a command",
    ask_user: "Asked a question",
  };
  return map[name] ?? name.replace(/_/g, " ");
}

type Source = { title: string; url: string };

/** Collect web search / fetch sources from an assistant turn's tool events. */
function extractSources(events: PublicToolEvent[]): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const evt of events) {
    if (evt.status !== "done" || !evt.result) continue;
    if (evt.name === "web_search") {
      const r = evt.result as { results?: Array<{ title?: string; url?: string }> };
      for (const item of r.results ?? []) {
        if (item.url && !seen.has(item.url)) {
          seen.add(item.url);
          sources.push({ title: item.title ?? item.url, url: item.url });
        }
      }
    }
    if (evt.name === "web_fetch") {
      const r = evt.result as { url?: string; title?: string };
      if (r.url && !seen.has(r.url)) {
        seen.add(r.url);
        sources.push({ title: r.title ?? r.url, url: r.url });
      }
    }
  }
  return sources;
}

/**
 * Read-only summary of the tool calls the assistant ran during a turn. Renders
 * a labeled list of steps plus, when present, a flat list of web sources. No
 * interactive controls (terminals, approvals) — this is a public snapshot.
 */
function ToolEventsBlock({ events }: { events: PublicToolEvent[] }) {
  const done = events.filter((e) => e.status === "done");
  if (done.length === 0) return null;
  const sources = extractSources(done);

  return (
    <div className="mb-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
        {done.length} {done.length === 1 ? "step" : "steps"}
      </p>
      <ul className="mt-1.5 flex flex-col gap-1">
        {done.map((evt) => (
          <li
            key={evt.call_id}
            className="flex items-center gap-2 text-[12.5px] text-white/55"
          >
            <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-[#3ecf8e]/60" />
            {toolLabel(evt.name)}
          </li>
        ))}
      </ul>
      {sources.length > 0 && (
        <div className="mt-2.5 border-t border-white/[0.05] pt-2">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-white/30">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </p>
          <ul className="flex flex-col gap-0.5">
            {sources.map((s) => (
              <li key={s.url} className="min-w-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-[12px] text-[#3ecf8e]/75 underline-offset-2 hover:text-[#3ecf8e] hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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

            if (lang === "dot" || lang === "graphviz") {
              return <GraphvizDiagram code={raw} />;
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
          img({ src, alt }) {
            const url = typeof src === "string" ? src : undefined;
            if (!url) return null;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={alt ?? ""}
                loading="lazy"
                className="my-3 block h-auto max-w-full rounded-lg border border-white/[0.08]"
              />
            );
          },
        }}
      >
        {normalizeMarkdownLists(content)}
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
            {message.toolEvents && message.toolEvents.length > 0 && (
              <ToolEventsBlock events={message.toolEvents} />
            )}
            <AssistantMarkdown content={message.content} />
            {message.followUps && message.followUps.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[12px] font-semibold text-white/50">
                  Follow-ups
                </p>
                <ul className="flex flex-col divide-y divide-white/[0.05]">
                  {message.followUps.map((q, qi) => (
                    <li
                      key={qi}
                      className="flex items-start gap-2.5 py-2 text-[13px] text-white/55"
                    >
                      <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-[#3ecf8e]/50" />
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
