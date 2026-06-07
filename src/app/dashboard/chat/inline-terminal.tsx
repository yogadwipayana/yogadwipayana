"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Loader2, Maximize2, Minus, Terminal, X } from "lucide-react";

export interface TerminalCommandResult {
  /** Cleaned stdout/stderr produced by the command (ANSI stripped). */
  output: string;
  /** Exit code parsed from the trailing sentinel, or null if unknown/timed out. */
  exitCode: number | null;
  /** True if capture was cut short (timeout or size cap). */
  truncated: boolean;
  /** Set when the command could not be dispatched at all. */
  error?: string;
}

export interface InlineSshTerminalHandle {
  /** Type text directly into the terminal's SSH session (e.g. a command + "\n"). */
  injectInput(text: string): void;
  /**
   * Run a command and resolve with its captured output once it completes.
   * Wraps the command in unique sentinel markers so the surrounding shell
   * echo, prompt, and unrelated output are excluded from the result.
   */
  runCommand(command: string, callId: string): Promise<TerminalCommandResult>;
}

/** Strip ANSI/VT escape sequences (CSI, OSC, single-char) from terminal text. */
function stripAnsi(input: string): string {
  return input
    // OSC: ESC ] ... BEL  or  ESC ] ... ESC \
    .replace(/\][^]*(?:|\\)/g, "")
    // CSI: ESC [ ... final-byte
    .replace(/\[[0-9;?]*[ -/]*[@-~]/g, "")
    // Other two-char escapes
    .replace(/[@-Z\\-_]/g, "");
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
    const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
    const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
    // Active command capture: when set, raw ws output is accumulated here and
    // scanned for the start/end sentinel markers to extract command output.
    const captureRef = useRef<{
      buffer: string;
      startMarker: string;
      endMarker: string;
      started: boolean;
      resolve: (r: TerminalCommandResult) => void;
      timer: ReturnType<typeof setTimeout>;
    } | null>(null);
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
      runCommand(command: string, callId: string): Promise<TerminalCommandResult> {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          return Promise.resolve({
            output: "",
            exitCode: null,
            truncated: false,
            error: "Terminal is not connected.",
          });
        }
        // Only one capture at a time — resolve any prior one as truncated.
        const prior = captureRef.current;
        if (prior) {
          clearTimeout(prior.timer);
          prior.resolve({
            output: stripAnsi(prior.buffer),
            exitCode: null,
            truncated: true,
            error: "Superseded by a newer command.",
          });
          captureRef.current = null;
        }

        const token = callId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) || "cmd";
        const startMarker = `__CMDSTART_${token}__`;
        const endMarker = `__CMDEND_${token}__`;

        return new Promise<TerminalCommandResult>((resolve) => {
          const timer = setTimeout(() => {
            const cap = captureRef.current;
            captureRef.current = null;
            resolve({
              output: cap ? stripAnsi(cap.buffer) : "",
              exitCode: null,
              truncated: true,
              error: "Command timed out before completion.",
            });
          }, 120_000);

          captureRef.current = {
            buffer: "",
            startMarker,
            endMarker,
            started: false,
            resolve,
            timer,
          };

          // Wrap so we can isolate the command's own output between markers and
          // read its exit code. `printf` avoids echo portability issues.
          // The markers are printed by the shell, not echoed as input noise we
          // care about, because we slice strictly between them.
          const wrapped =
            `printf '\\n${startMarker}\\n'; ${command}\n` +
            `printf '${endMarker}%d\\n' "$?"\n`;
          ws.send(new TextEncoder().encode(wrapped));
        });
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
        termRef.current = term;
        fitAddonRef.current = fitAddon;
        requestAnimationFrame(() => {
          if (mounted) fitAddon.fit();
        });

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        // Accumulate output for an in-flight runCommand() capture and resolve
        // it once the end sentinel (with exit code) appears.
        function feedCapture(chunk: string): void {
          const cap = captureRef.current;
          if (!cap) return;
          cap.buffer += chunk;

          // Hard size cap to avoid unbounded growth on a runaway command.
          if (cap.buffer.length > 500_000) {
            cap.buffer = cap.buffer.slice(-500_000);
          }

          const clean = stripAnsi(cap.buffer);
          // Match the REAL end marker: it is followed by the exit-code digits.
          // The echoed command line contains "<endMarker>%d" (literal %d, not
          // digits) so this regex skips it and only fires on the printf output.
          const endRe = new RegExp(`${cap.endMarker}(\\d+)`);
          const endHit = endRe.exec(clean);
          if (!endHit) return;

          const exitCode = parseInt(endHit[1], 10);
          const endIdx = endHit.index;

          // Output is between the LAST start marker before endIdx and endIdx.
          // (The wrapped command is echoed once, then the real marker prints, so
          //  the last occurrence is the one that precedes genuine output.)
          let output = "";
          const startIdx = clean.lastIndexOf(cap.startMarker, endIdx);
          if (startIdx !== -1) {
            output = clean.slice(startIdx + cap.startMarker.length, endIdx);
          } else {
            output = clean.slice(0, endIdx);
          }
          output = output.replace(/^\n+/, "").replace(/\n+$/, "");

          clearTimeout(cap.timer);
          captureRef.current = null;
          cap.resolve({ output, exitCode, truncated: false });
        }

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
            const bytes = new Uint8Array(event.data);
            term.write(bytes);
            feedCapture(decoder.decode(bytes, { stream: true }));
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
              feedCapture(event.data);
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
          termRef.current = null;
          fitAddonRef.current = null;
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

    // Re-fit and redraw when expanding from a minimized state. The container is
    // kept mounted (hidden via CSS), so the Terminal stays attached to its DOM
    // node — but xterm can't measure a display:none element, so we re-measure
    // once it's visible again.
    useEffect(() => {
      if (minimized) return;
      const term = termRef.current;
      const fitAddon = fitAddonRef.current;
      if (!term || !fitAddon) return;
      requestAnimationFrame(() => {
        fitAddon.fit();
        term.refresh(0, term.rows - 1);
      });
    }, [minimized]);

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

        {/* Body — kept mounted (hidden via CSS when minimized) so the xterm
            instance stays attached to its DOM node across minimize/expand. */}
        <div className={minimized ? "hidden" : "block"}>
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
        </div>
      </div>
    );
  },
);
