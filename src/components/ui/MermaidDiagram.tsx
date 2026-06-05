"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Loader2 } from "lucide-react";

let _initialized = false;
function ensureInit() {
  if (_initialized) return;
  _initialized = true;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    darkMode: true,
    themeVariables: {
      background: "#0f0f0f",
      primaryColor: "#3ecf8e",
      primaryTextColor: "#e5e5e5",
      lineColor: "#ffffff40",
      edgeLabelBackground: "#1a1a1a",
      tertiaryColor: "#1a1a1a",
    },
  });
}

export function MermaidDiagram({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureInit();

    (async () => {
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

  return (
    <div
      ref={containerRef}
      className="my-2 overflow-x-auto rounded-lg border border-white/[0.07] bg-[#0f0f0f] p-4 [&_svg]:max-w-full"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
