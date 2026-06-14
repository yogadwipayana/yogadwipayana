"use client";

import { useEffect, useState } from "react";
import type { Viz } from "@viz-js/viz";
import { Loader2 } from "lucide-react";
import { DiagramViewer } from "@/components/ui/DiagramViewer";

let _vizPromise: Promise<Viz> | null = null;
function getViz(): Promise<Viz> {
  if (!_vizPromise) {
    _vizPromise = import("@viz-js/viz").then((mod) => mod.instance());
  }
  return _vizPromise;
}

// Graphviz emits a white canvas with black shapes/text by default. Recolor only
// those default tokens so the diagram matches the dark theme while leaving any
// author-specified colors untouched.
function themeSvg(svg: string): string {
  return svg
    .replace(/fill="white"/g, 'fill="#0f0f0f"')
    .replace(/fill="#ffffff"/gi, 'fill="#0f0f0f"')
    .replace(/stroke="black"/g, 'stroke="#ffffff66"')
    .replace(/stroke="#000000"/gi, 'stroke="#ffffff66"')
    .replace(/fill="black"/g, 'fill="#e5e5e5"')
    .replace(/fill="#000000"/gi, 'fill="#e5e5e5"');
}

export function GraphvizDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const viz = await getViz();
        if (cancelled) return;

        const result = viz.render(code, { format: "svg" });
        if (cancelled) return;

        if (result.status !== "success") {
          setSvg(null);
          setError(
            result.errors?.map((e) => e.message).join("\n") ||
              "Diagram syntax is incomplete or invalid.",
          );
          return;
        }

        setError(null);
        setSvg(themeSvg(result.output));
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
          Graphviz error
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

  return <DiagramViewer svg={svg} kind="graphviz" />;
}
