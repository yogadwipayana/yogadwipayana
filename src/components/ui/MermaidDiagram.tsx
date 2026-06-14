"use client";

import { useEffect, useState } from "react";
import type { Mermaid } from "mermaid";
import { Loader2 } from "lucide-react";
import { DiagramViewer } from "@/components/ui/DiagramViewer";

// Lazy, module-level singleton import so the (heavy) mermaid bundle is only
// fetched the first time a diagram actually renders, and reused thereafter.
let _mermaidPromise: Promise<Mermaid> | null = null;
function getMermaid(): Promise<Mermaid> {
  if (!_mermaidPromise) {
    _mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        darkMode: true,
        // Render labels as native SVG <text> rather than foreignObject HTML, so
        // the diagram rasterizes cleanly when copied as PNG via canvas.
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        themeVariables: {
          background: "#0f0f0f",
          primaryColor: "#3ecf8e",
          primaryTextColor: "#e5e5e5",
          lineColor: "#ffffff40",
          edgeLabelBackground: "#1a1a1a",
          tertiaryColor: "#1a1a1a",
        },
      });
      return mermaid;
    });
  }
  return _mermaidPromise;
}

export function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const mermaid = await getMermaid();
      if (cancelled) return;

      // Pre-validate with `suppressErrors` so an invalid (often still-
      // streaming or truncated) diagram doesn't fall through to the default
      // mermaid render path that injects the giant "Syntax error in text"
      // bomb SVG into our container.
      const parsed = await mermaid.parse(code, { suppressErrors: true });
      if (cancelled) return;
      if (!parsed) {
        setSvg(null);
        setError("Diagram syntax is incomplete or invalid.");
        return;
      }

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      try {
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) {
          setError(null);
          setSvg(rendered);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvg(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) {
    return (
      <div className="my-2 overflow-hidden rounded-lg border border-red-500/20 bg-red-500/[0.05] p-3 font-mono text-[12px] text-red-400/80">
        <span className="mb-1 block text-[10px] uppercase tracking-widest text-red-400/50">
          Mermaid error
        </span>
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-2 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#0f0f0f] px-3 py-4 text-[12px] text-white/30">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Rendering diagram…
      </div>
    );
  }

  return <DiagramViewer svg={svg} kind="mermaid" />;
}
