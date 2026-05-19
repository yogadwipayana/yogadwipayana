"use client";

import { useEffect, useRef } from "react";

interface Config {
  instanceId: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

interface Props {
  config: Config;
  onStatus: (
    status: "connecting" | "ready" | "error" | "closed",
    message?: string,
  ) => void;
}

export function SshTerminal({ config, onStatus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    let ws: WebSocket | null = null;
    let cleanupTerm: (() => void) | null = null;
    let resizeListener: (() => void) | null = null;

    async function init() {
      if (!containerRef.current || !mounted) return;

      // Dynamic imports — xterm touches `window`, must be client-only
      const [
        { Terminal },
        { FitAddon },
        { WebLinksAddon },
        { SearchAddon },
      ] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/addon-web-links"),
        import("@xterm/addon-search"),
      ]);
      await import("@xterm/xterm/css/xterm.css");

      if (!mounted || !containerRef.current) return;

      const term = new Terminal({
        theme: { background: "#0a0a0a" },
        cursorBlink: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        scrollback: 5000,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(searchAddon);
      term.open(containerRef.current);

      requestAnimationFrame(() => {
        if (mounted) fitAddon.fit();
      });

      // Ctrl+Shift+F → open search
      term.attachCustomKeyEventHandler((e) => {
        if (e.ctrlKey && e.shiftKey && e.key === "F") {
          searchAddon.findNext("");
          return false;
        }
        return true;
      });

      const encoder = new TextEncoder();

      const wsUrl =
        window.location.origin.replace(/^http/, "ws") + "/api/ssh/ws";
      ws = new WebSocket(wsUrl);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        if (!mounted) {
          ws?.close();
          return;
        }
        const { cols, rows } = term;
        ws!.send(
          JSON.stringify({
            type: "connect",
            instanceId: config.instanceId,
            authMethod: config.authMethod,
            host: config.host,
            port: config.port,
            username: config.username,
            ...(config.password !== undefined && { password: config.password }),
            ...(config.privateKey !== undefined && {
              privateKey: config.privateKey,
            }),
            ...(config.passphrase !== undefined && {
              passphrase: config.passphrase,
            }),
            cols,
            rows,
          }),
        );
        onStatus("connecting");
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
              onStatus(
                msg.status as "connecting" | "ready" | "error" | "closed",
                msg.message,
              );
            }
          } catch {
            // non-JSON text frame — write directly
            term.write(event.data);
          }
        }
      };

      ws.onerror = () => {
        if (!mounted) return;
        onStatus("error", "WebSocket connection failed.");
      };

      ws.onclose = (e) => {
        if (!mounted) return;
        if (e.code !== 1000 && e.code !== 1001) {
          onStatus(
            "error",
            e.reason || `Connection closed unexpectedly (code ${e.code}).`,
          );
        } else {
          onStatus("closed");
        }
      };

      // xterm input → ws (binary frames per protocol spec)
      const dataDisposable = term.onData((data) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(data));
        }
      });

      // xterm resize → ws
      const resizeDisposable = term.onResize(({ cols, rows }) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      // window resize → fit
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
    };
    // config is stable for the lifetime of a connection — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-[60vh] w-full bg-[#0a0a0a] md:h-[calc(100vh-12rem)]"
      aria-label="SSH terminal"
    />
  );
}
