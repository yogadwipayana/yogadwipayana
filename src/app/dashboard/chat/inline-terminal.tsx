"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Maximize2, Minus, Terminal, X } from "lucide-react";

export interface InlineSshTerminalHandle {
  /** Type text directly into the terminal's SSH session (e.g. a command + "\n"). */
  injectInput(text: string): void;
}

interface Props {
  instanceId: string;
  instanceName: string;
  onClose?: () => void;
}

/**
 * Embedded SSH terminal for the chat panel.
 * Connects via the `/api/ssh/ws` WebSocket using `connect_saved` — no
 * credentials ever reach the browser; the server fetches them server-side.
 */
export const InlineSshTerminal = forwardRef<InlineSshTerminalHandle, Props>(
  function InlineSshTerminal({ instanceId, instanceName, onClose }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<
      "connecting" | "ready" | "error" | "closed"
    >("connecting");
    const [errorMsg, setErrorMsg] = useState("");
    const [minimized, setMinimized] = useState(false);

    useImperativeHandle(ref, () => ({
      injectInput(text: string) {
        const ws = wsRef.current;
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(text));
        }
      },
    }));

    useEffect(() => {
      let mounted = true;
      let ws: WebSocket | null = null;
      let cleanupTerm: (() => void) | null = null;
      let resizeListener: (() => void) | null = null;

      async function init() {
        if (!containerRef.current || !mounted) return;

        const [{ Terminal: XTerm }, { FitAddon }, { WebLinksAddon }] =
          await Promise.all([
            import("@xterm/xterm"),
            import("@xterm/addon-fit"),
            import("@xterm/addon-web-links"),
          ]);
        await import("@xterm/xterm/css/xterm.css");

        if (!mounted || !containerRef.current) return;

        const term = new XTerm({
          theme: { background: "#0a0a0a" },
          cursorBlink: true,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          scrollback: 5000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.open(containerRef.current);
        requestAnimationFrame(() => {
          if (mounted) fitAddon.fit();
        });

        const encoder = new TextEncoder();
        const wsUrl =
          window.location.origin.replace(/^http/, "ws") + "/api/ssh/ws";
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          if (!mounted) {
            ws?.close();
            return;
          }
          const { cols, rows } = term;
          ws!.send(
            JSON.stringify({ type: "connect_saved", instanceId, cols, rows }),
          );
        };

        ws.onmessage = (event) => {
          if (!mounted) return;
          if (event.data instanceof ArrayBuffer) {
            term.write(new Uint8Array(event.data));
          } else if (typeof event.data === "string") {
            try {
              const msg = JSON.parse(event.data) as {
                type: string;
                status?: string;
                message?: string;
              };
              if (msg.type === "status") {
                const s = msg.status as typeof status;
                setStatus(s);
                if (s === "error") setErrorMsg(msg.message ?? "Connection error");
              }
            } catch {
              term.write(event.data);
            }
          }
        };

        ws.onerror = () => {
          if (!mounted) return;
          setStatus("error");
          setErrorMsg("WebSocket connection failed.");
        };

        ws.onclose = (e) => {
          if (!mounted) return;
          if (e.code !== 1000 && e.code !== 1001) {
            setStatus("error");
            setErrorMsg(e.reason || `Connection closed (code ${e.code})`);
          } else {
            setStatus("closed");
          }
        };

        const dataDisposable = term.onData((data) => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(encoder.encode(data));
        });

        const resizeDisposable = term.onResize(({ cols, rows }) => {
          if (ws?.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "resize", cols, rows }));
        });

        resizeListener = () => fitAddon.fit();
        window.addEventListener("resize", resizeListener);

        cleanupTerm = () => {
          dataDisposable.dispose();
          resizeDisposable.dispose();
          term.dispose();
        };
      }

      init();

      return () => {
        mounted = false;
        cleanupTerm?.();
        if (resizeListener) window.removeEventListener("resize", resizeListener);
        if (ws && ws.readyState < WebSocket.CLOSING) ws.close(1000, "unmount");
        wsRef.current = null;
      };
      // instanceId is stable for the lifetime of a session
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [instanceId]);

    return (
      <div className="overflow-hidden rounded-lg border border-white/[0.08]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f0f] px-3 py-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-white/40" aria-hidden />
            <span className="font-mono text-[12px] text-white/60">
              {instanceName}
            </span>
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                status === "ready"
                  ? "bg-[#3ecf8e]"
                  : status === "connecting"
                    ? "animate-pulse bg-yellow-400"
                    : status === "error"
                      ? "bg-red-400"
                      : "bg-white/20"
              }`}
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMinimized((v) => !v)}
              className="inline-flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:text-white/60"
              aria-label={minimized ? "Expand terminal" : "Minimize terminal"}
            >
              {minimized ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:text-red-400"
                aria-label="Close terminal"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {!minimized && (
          <>
            {status === "error" && (
              <div className="border-b border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
                {errorMsg}
              </div>
            )}
            {status === "closed" && (
              <div className="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-white/40">
                Connection closed.
              </div>
            )}
            {status === "connecting" && (
              <div className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-2 text-[12px] text-white/35">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Connecting…
              </div>
            )}
            <div
              ref={containerRef}
              className="h-64 w-full bg-[#0a0a0a] md:h-72"
              aria-label="SSH terminal"
            />
          </>
        )}
      </div>
    );
  },
);
