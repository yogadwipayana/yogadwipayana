"use client";

import { useCallback, useEffect, useRef, useState } from "react";
// useRef is used in CopyButton for the copy-reset timer
import { Check, Copy, ExternalLink, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import type { GeneratedImageRow } from "@/lib/server/image-service";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const TABS = [
  { id: "avatar", label: "Avatar" },
  { id: "og-default", label: "OG Default" },
  { id: "og-page", label: "OG Per-page" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const OG_PAGES = ["/", "/about", "/tools", "/dashboard"] as const;

const DEFAULT_PROMPTS: Record<TabId, string> = {
  avatar:
    "A clean, professional headshot illustration of a developer, soft lighting, neutral background, friendly expression, technical aesthetic, suitable for a personal portfolio site",
  "og-default":
    "A minimal Supabase-inspired hero image, dark background #1c1c1c with subtle green #3ecf8e accents, abstract geometric pattern suggesting code and infrastructure, suitable for social-link previews",
  "og-page":
    "A minimal Supabase-inspired Open Graph image for the \"{page}\" page of a developer portfolio. Dark background #1c1c1c, subtle green #3ecf8e accents, abstract geometric pattern, page name subtly integrated, suitable for social-link previews",
};

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type GeneratePayload = {
  target: TabId;
  page?: string;
  prompt?: string;
  reference_image_url?: string;
};

/* -------------------------------------------------------------------------- */
/*  CopyButton                                                                 */
/* -------------------------------------------------------------------------- */

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [text]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e]"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-[#3ecf8e]" aria-hidden />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  HistoryGrid                                                                */
/* -------------------------------------------------------------------------- */

function HistoryGrid({ images }: { images: GeneratedImageRow[] }) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-10 text-center">
        <ImagePlus className="h-6 w-6 text-white/20" aria-hidden />
        <p className="text-[13px] text-white/35">No generations yet.</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((img) => (
        <li
          key={img.id}
          className="group relative overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url ?? ""}
            alt={img.prompt}
            title={img.prompt}
            className="aspect-video w-full object-cover"
            loading="lazy"
          />
          <div className="flex items-center justify-between gap-1 border-t border-white/[0.06] px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            <span className="truncate font-mono text-[10px] text-white/35">
              {img.size ?? "auto"}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <CopyButton text={img.url ?? ""} label="Copy URL" />
              <a
                href={img.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open image"
                title="Open image"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e]"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  GenerateCard                                                               */
/* -------------------------------------------------------------------------- */

function GenerateCard({
  tab,
  onGenerated,
}: {
  tab: TabId;
  onGenerated: (row: GeneratedImageRow) => void;
}) {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPTS[tab]);
  const [refUrl, setRefUrl] = useState("");
  const [page, setPage] = useState<string>(OG_PAGES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GeneratedImageRow | null>(null);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: GeneratePayload = {
        target: tab,
        prompt: prompt.trim() || undefined,
        reference_image_url: refUrl.trim() || undefined,
        ...(tab === "og-page" ? { page } : {}),
      };
      const res = await fetch("/api/admin/og-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { image: GeneratedImageRow };
      setLastResult(data.image);
      onGenerated(data.image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }, [tab, prompt, refUrl, page, onGenerated]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page selector — only for og-page */}
      {tab === "og-page" && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="og-page-select"
            className="text-[11px] uppercase tracking-[0.1em] text-white/40"
          >
            Page
          </label>
          <select
            id="og-page-select"
            value={page}
            onChange={(e) => setPage(e.target.value)}
            className="w-full rounded-md border border-white/[0.08] bg-[#0f0f0f] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-white/[0.2]"
          >
            {OG_PAGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Prompt */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`prompt-${tab}`}
          className="text-[11px] uppercase tracking-[0.1em] text-white/40"
        >
          Prompt
        </label>
        <textarea
          id={`prompt-${tab}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-white/[0.08] bg-[#0f0f0f] px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.2]"
          placeholder="Describe the image…"
        />
      </div>

      {/* Reference image URL */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`ref-${tab}`}
          className="text-[11px] uppercase tracking-[0.1em] text-white/40"
        >
          Reference image URL{" "}
          <span className="normal-case tracking-normal text-white/25">(optional)</span>
        </label>
        <input
          id={`ref-${tab}`}
          type="url"
          value={refUrl}
          onChange={(e) => setRefUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-md border border-white/[0.08] bg-[#0f0f0f] px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none transition-colors focus:border-white/[0.2]"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300/80">
          {error}
        </p>
      )}

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Generating… (~90 s)
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Regenerate
          </>
        )}
      </button>

      {/* Last result preview */}
      {lastResult && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.04] p-3">
          <p className="text-[11px] uppercase tracking-[0.1em] text-[#3ecf8e]/70">
            Latest result
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lastResult.url ?? ""}
            alt={lastResult.prompt}
            className="w-full rounded-md object-cover"
          />
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-white/60">
              {lastResult.url}
            </code>
            <CopyButton text={lastResult.url ?? ""} label="Copy URL" />
            <a
              href={lastResult.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open image"
              title="Open image"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
          <p className="text-[11px] text-white/35">
            Saved to <code className="font-mono">/generated-images/</code>. To use as the live
            avatar or OG image, copy the URL above and update the relevant component or{" "}
            <code className="font-mono">metadata.openGraph</code>.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main client component                                                      */
/* -------------------------------------------------------------------------- */

export function OgAdminClient({
  initialImages,
}: {
  initialImages: GeneratedImageRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("avatar");
  const [images, setImages] = useState<GeneratedImageRow[]>(initialImages);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleGenerated = useCallback((row: GeneratedImageRow) => {
    setImages((prev) => [row, ...prev]);
  }, []);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/admin/og-images");
      if (res.ok) {
        const data = await res.json() as { images: GeneratedImageRow[] };
        setImages(data.images);
      }
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#3ecf8e]">
          Admin
        </p>
        <h1 className="mt-1 text-[22px] font-medium tracking-[-0.02em] text-white sm:text-[26px]">
          OG Image Generator
        </h1>
        <p className="mt-1.5 max-w-lg text-[13px] leading-[1.6] text-white/50">
          Generate avatar and Open Graph images on demand. Results are saved to{" "}
          <code className="font-mono text-white/70">/generated-images/</code> — copy the URL
          and update the relevant component or metadata manually.
        </p>
      </div>

      {/* Tabs + card */}
      <div className="flex flex-col gap-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#171717]">
        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Image target"
          className="flex border-b border-white/[0.08]"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              aria-controls={`tabpanel-${t.id}`}
              id={`tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-4 py-3 text-[13px] font-medium transition-colors ${
                activeTab === t.id
                  ? "border-b-2 border-[#3ecf8e] text-white"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        {TABS.map((t) => (
          <div
            key={t.id}
            id={`tabpanel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${t.id}`}
            hidden={activeTab !== t.id}
            className="p-4 sm:p-6"
          >
            {activeTab === t.id && (
              <GenerateCard tab={t.id} onGenerated={handleGenerated} />
            )}
          </div>
        ))}
      </div>

      {/* History */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[15px] font-medium text-white">History</h2>
          <button
            type="button"
            onClick={refreshHistory}
            disabled={loadingHistory}
            aria-label="Refresh history"
            title="Refresh history"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] text-white/60 transition-colors hover:border-[#3ecf8e]/40 hover:bg-[#3ecf8e]/10 hover:text-[#3ecf8e] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`}
              aria-hidden
            />
          </button>
        </div>
        <HistoryGrid images={images} />
      </div>
    </div>
  );
}
