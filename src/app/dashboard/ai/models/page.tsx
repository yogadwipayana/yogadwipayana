"use client";

import { useState } from "react";
import { Check, Copy, Search } from "lucide-react";

import { AI_MODELS } from "../../data";

/* -------------------------------------------------------------------------- */
/*  Provider badge colors                                                      */
/* -------------------------------------------------------------------------- */

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "bg-[#d4a574]/10 text-[#d4a574]",
  OpenAI:    "bg-[#3ecf8e]/10 text-[#3ecf8e]",
  Meta:      "bg-blue-500/10 text-blue-300",
  Mistral:   "bg-orange-500/10 text-orange-300",
  Google:    "bg-yellow-500/10 text-yellow-300",
  Voyage:    "bg-purple-500/10 text-purple-300",
};

function providerColor(provider: string) {
  return PROVIDER_COLORS[provider] ?? "bg-white/[0.06] text-white/50";
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function AiModelsPage() {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const baseUrl = "https://ai.yogathedev.com/v1";

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1500);
    });
  }

  const filtered = AI_MODELS.filter(
    (m) =>
      query === "" ||
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.provider.toLowerCase().includes(query.toLowerCase()) ||
      m.modelId.toLowerCase().includes(query.toLowerCase()),
  );

  /* Group by provider */
  const grouped = filtered.reduce<Record<string, typeof AI_MODELS>>((acc, m) => {
    (acc[m.provider] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        {/* Title + search */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium text-white">Available Models</h2>
            <p className="mt-1 text-[13px] text-white/40">
              All models accessible through the AI router — pricing per 1M tokens.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#171717] px-3 py-2 focus-within:border-[#3ecf8e]/40">
            <Search className="h-3.5 w-3.5 shrink-0 text-white/30" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter models…"
              className="w-40 bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-4 rounded-lg border border-white/[0.06] bg-[#171717] px-5 py-3 text-[12px]">
          <span className="text-white/50"><span className="font-medium text-white">{AI_MODELS.length}</span> models</span>
          <span className="text-white/20">·</span>
          <span className="text-white/50"><span className="font-medium text-white">{Object.keys(grouped).length}</span> providers</span>
          <span className="text-white/20">·</span>
          <span className="text-white/50">OpenAI-compatible API</span>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-lg border border-white/[0.08] md:block">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#171717]">
                {["Model", "Provider", "Context", "Input / 1M", "Output / 1M", "Model ID"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white/25">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((model) => (
                <tr key={model.slug} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{model.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${providerColor(model.provider)}`}>
                      {model.provider}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-white/60">{model.contextWindow}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[#3ecf8e]">{model.inputPrice}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[#3ecf8e]">{model.outputPrice}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => copy(model.modelId, `model:${model.slug}`)}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] text-white/35 transition-colors hover:text-white/70"
                      aria-label={`Copy model ID ${model.modelId}`}
                    >
                      {model.modelId}
                      {copied === `model:${model.slug}` ? (
                        <Check className="h-3 w-3 text-[#3ecf8e]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards grouped by provider */}
        <div className="space-y-5 md:hidden">
          {Object.entries(grouped).map(([provider, models]) => (
            <div key={provider}>
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${providerColor(provider)}`}>{provider}</span>
              </div>
              <div className="space-y-2">
                {models.map((model) => (
                  <div key={model.slug} className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-white">{model.name}</p>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-[12px] text-[#3ecf8e]">{model.inputPrice}</p>
                        <p className="font-mono text-[11px] text-white/40">in / 1M</p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                      <div><dt className="text-white/30">Context</dt><dd className="mt-0.5 font-mono text-white/70">{model.contextWindow}</dd></div>
                      <div><dt className="text-white/30">Output / 1M</dt><dd className="mt-0.5 font-mono text-[#3ecf8e]">{model.outputPrice}</dd></div>
                      <div className="col-span-2">
                        <dt className="text-white/30">Model ID</dt>
                        <dd className="mt-0.5">
                          <button
                            type="button"
                            onClick={() => copy(model.modelId, `model:${model.slug}`)}
                            className="inline-flex max-w-full items-center gap-1.5 font-mono text-[11px] text-white/35 transition-colors hover:text-white/70"
                            aria-label={`Copy model ID ${model.modelId}`}
                          >
                            <span className="truncate">{model.modelId}</span>
                            {copied === `model:${model.slug}` ? (
                              <Check className="h-3 w-3 shrink-0 text-[#3ecf8e]" />
                            ) : (
                              <Copy className="h-3 w-3 shrink-0" />
                            )}
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-lg border border-white/[0.06] py-14 text-center text-[13px] text-white/30">
            No models match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* API connection info */}
        <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
          <div className="border-b border-white/[0.05] px-5 py-3.5">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/30">API Connection</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/35">Base URL</p>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-[#3ecf8e]">
                  {baseUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(baseUrl, "url")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/[0.08] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                  aria-label="Copy base URL"
                >
                  {copied === "url" ? <Check className="h-3.5 w-3.5 text-[#3ecf8e]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                OpenAI-compatible endpoint. Point any OpenAI SDK at this URL using your API key from the Keys page.
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/35">Quick example</p>
              <div className="mt-1.5 flex items-start gap-2">
                <pre className="flex-1 overflow-x-auto rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2.5 font-mono text-[11px] leading-relaxed text-white/70">
{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4.6","messages":[{"role":"user","content":"Hi"}]}'`}
                </pre>
                <button
                  type="button"
                  onClick={() => copy(
                    `curl ${baseUrl}/chat/completions \\\n  -H "Authorization: Bearer YOUR_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model":"claude-sonnet-4.6","messages":[{"role":"user","content":"Hi"}]}'`,
                    "example",
                  )}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white"
                  aria-label="Copy example"
                >
                  {copied === "example" ? <Check className="h-3.5 w-3.5 text-[#3ecf8e]" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
