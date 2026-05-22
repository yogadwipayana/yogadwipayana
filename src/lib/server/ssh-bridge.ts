import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Client } from "ssh2";
import type { WebSocket } from "ws";

import { makeHostVerifier } from "@/lib/server/ssh-host-pin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionUser = { id: string; email: string };
type SessionResult = { user: SessionUser; supabase: SupabaseClient } | null;

type InstanceRow = {
  id: string;
  user_id: string;
  ip_public: string | null;
  ip_private: string | null;
};

type ConnectFrame = {
  type: "connect";
  instanceId: string;
  authMethod: "password" | "key";
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  cols: number;
  rows: number;
};

type ResizeFrame = {
  type: "resize";
  cols: number;
  rows: number;
};

type StatusMessage =
  | { type: "status"; status: "connecting" | "ready" | "closed" }
  | { type: "status"; status: "error"; message: string };

// ---------------------------------------------------------------------------
// Cookie parsing (no external dependency)
// ---------------------------------------------------------------------------

function parseCookieHeader(header: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of header.split("; ")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) result[name] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Session validation
// ---------------------------------------------------------------------------

export async function validateSessionFromCookies(
  cookieHeader: string | undefined,
): Promise<SessionResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const parsed = parseCookieHeader(cookieHeader ?? "");

  const cookieAdapter: CookieMethodsServer = {
    getAll() {
      return Object.entries(parsed).map(([name, value]) => ({ name, value }));
    },
    setAll() {},
  };

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: cookieAdapter,
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) return null;
  return { user: { id: user.id, email: user.email }, supabase };
}

async function getInstanceForUser(
  supabase: SupabaseClient,
  userId: string,
  instanceId: string,
): Promise<InstanceRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("instance")
    .select("id, user_id, ip_public, ip_private")
    .eq("id", instanceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();

  if (error) return null;
  return (data as InstanceRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendStatus(ws: WebSocket, msg: StatusMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ---------------------------------------------------------------------------
// SSH session wiring
// ---------------------------------------------------------------------------

export function attachSshSession(
  ws: WebSocket,
  userId: string,
  supabase: SupabaseClient,
): void {
  const conn = new Client();
  let sshReady = false;

  // ------------------------------------------------------------------
  // First message must be the connect frame
  // ------------------------------------------------------------------
  function onFirstMessage(data: Buffer | string, isBinary: boolean): void {
    if (isBinary) {
      sendStatus(ws, { type: "status", status: "error", message: "Expected connect frame" });
      ws.close(1002);
      return;
    }

    let frame: ConnectFrame;
    try {
      frame = JSON.parse(data.toString()) as ConnectFrame;
    } catch {
      sendStatus(ws, { type: "status", status: "error", message: "Invalid JSON in connect frame" });
      ws.close(1002);
      return;
    }

    if (frame.type !== "connect") {
      sendStatus(ws, { type: "status", status: "error", message: "Expected connect frame" });
      ws.close(1002);
      return;
    }

    // Remove first-message listener; subsequent messages handled after connect
    ws.off("message", onFirstMessage);

    handleConnect(frame);
  }

  ws.on("message", onFirstMessage);

  // ------------------------------------------------------------------
  // Handle connect frame
  // ------------------------------------------------------------------
  async function handleConnect(frame: ConnectFrame): Promise<void> {
    // Verify ownership and host match
    const instance = await getInstanceForUser(supabase, userId, frame.instanceId);

    if (!instance) {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message: "Instance not found or access denied",
      });
      ws.close(1008);
      return;
    }

    if (instance.ip_public && instance.ip_public !== frame.host) {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message: "Requested host does not match instance public IP",
      });
      ws.close(1008);
      return;
    }

    sendStatus(ws, { type: "status", status: "connecting" });

    // Build ssh2 connect config
    const connectConfig: Parameters<Client["connect"]>[0] = {
      host: frame.host,
      port: frame.port,
      username: frame.username,
      readyTimeout: 20_000,
      keepaliveInterval: 10_000,
      hostVerifier: makeHostVerifier({
        supabase,
        instanceId: frame.instanceId,
        userId,
        onReject: (reason) => {
          sendStatus(ws, {
            type: "status",
            status: "error",
            message: `SSH host key rejected: ${reason}`,
          });
        },
      }),
    };

    if (frame.authMethod === "password") {
      connectConfig.password = frame.password;
    } else {
      connectConfig.privateKey = Buffer.from(frame.privateKey ?? "");
      if (frame.passphrase) connectConfig.passphrase = frame.passphrase;
    }

    conn.connect(connectConfig);

    conn.on("ready", () => {
      sshReady = true;

      conn.shell(
        { term: "xterm-256color", cols: frame.cols, rows: frame.rows },
        (err, stream) => {
          if (err) {
            sendStatus(ws, {
              type: "status",
              status: "error",
              message: `Shell error: ${err.message}`,
            });
            ws.close(1011);
            conn.end();
            return;
          }

          sendStatus(ws, { type: "status", status: "ready" });

          // ----------------------------------------------------------
          // stdout → ws (binary)
          // ----------------------------------------------------------
          const HIGH_WATER = 1_000_000;
          const LOW_WATER = 256_000;
          const wsBuffered = () =>
            (ws as unknown as { bufferedAmount?: number }).bufferedAmount ?? 0;

          stream.on("data", (chunk: Buffer) => {
            if (ws.readyState !== ws.OPEN) return;

            ws.send(chunk);

            // Backpressure: pause stream if ws buffer is too full
            if (wsBuffered() > HIGH_WATER) {
              stream.pause();
              const check = () => {
                if (ws.readyState !== ws.OPEN) return;
                if (wsBuffered() < LOW_WATER) {
                  stream.resume();
                } else {
                  setTimeout(check, 50);
                }
              };
              setTimeout(check, 50);
            }
          });

          // stderr → ws (binary)
          stream.stderr.on("data", (chunk: Buffer) => {
            if (ws.readyState === ws.OPEN) ws.send(chunk);
          });

          // ----------------------------------------------------------
          // ws → ssh (binary = stdin, text = control frames)
          // ----------------------------------------------------------
          ws.on("message", (data: Buffer | string, isBinary: boolean) => {
            if (isBinary) {
              stream.write(data as Buffer);
              return;
            }

            let msg: ResizeFrame;
            try {
              msg = JSON.parse((data as Buffer).toString()) as ResizeFrame;
            } catch {
              return;
            }

            if (msg.type === "resize") {
              stream.setWindow(msg.rows, msg.cols, 0, 0);
            }
          });

          // ----------------------------------------------------------
          // Stream close → notify client
          // ----------------------------------------------------------
          stream.on("close", () => {
            sendStatus(ws, { type: "status", status: "closed" });
            ws.close(1000);
          });
        },
      );
    });

    conn.on("error", (err) => {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message: `SSH error: ${err.message}`,
      });
      ws.close(1011);
    });

    // ------------------------------------------------------------------
    // ws close → tear down ssh
    // ------------------------------------------------------------------
    ws.on("close", () => {
      if (sshReady) conn.end();
    });
  }
}
