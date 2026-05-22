import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Client } from "ssh2";
import type { WebSocket } from "ws";

import { decryptString } from "./crypto.ts";
import { makeHostVerifier } from "./ssh-host-pin.ts";

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

/**
 * Credential-free connect frame used by the inline chat terminal.
 * The bridge fetches saved credentials server-side so nothing sensitive
 * ever leaves the server to the browser.
 */
type ConnectSavedFrame = {
  type: "connect_saved";
  instanceId: string;
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

/**
 * Load and decrypt the saved SSH credential secrets for an instance.
 * Returns only the secret fields (password / privateKey / passphrase).
 * Returns null if no credential row exists or on DB error.
 */
async function loadSavedSecrets(
  supabase: SupabaseClient,
  userId: string,
  instanceId: string,
): Promise<{ password?: string; privateKey?: string; passphrase?: string } | null> {
  const { data, error } = await supabase
    .from("instance_ssh_credential")
    .select("auth_method, password_enc, private_key_enc, passphrase_enc")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as {
    auth_method: "password" | "key";
    password_enc: string | null;
    private_key_enc: string | null;
    passphrase_enc: string | null;
  };

  try {
    const result: { password?: string; privateKey?: string; passphrase?: string } = {};
    if (row.password_enc) result.password = decryptString(row.password_enc);
    if (row.private_key_enc) result.privateKey = decryptString(row.private_key_enc);
    if (row.passphrase_enc) result.passphrase = decryptString(row.passphrase_enc);
    return result;
  } catch {
    return null;
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
  // First message must be a connect frame (manual or saved-creds)
  // ------------------------------------------------------------------
  function onFirstMessage(data: Buffer | string, isBinary: boolean): void {
    if (isBinary) {
      sendStatus(ws, { type: "status", status: "error", message: "Expected connect frame" });
      ws.close(1002);
      return;
    }

    let frame: ConnectFrame | ConnectSavedFrame;
    try {
      frame = JSON.parse(data.toString()) as ConnectFrame | ConnectSavedFrame;
    } catch {
      sendStatus(ws, { type: "status", status: "error", message: "Invalid JSON in connect frame" });
      ws.close(1002);
      return;
    }

    if (frame.type !== "connect" && frame.type !== "connect_saved") {
      sendStatus(ws, { type: "status", status: "error", message: "Expected connect or connect_saved frame" });
      ws.close(1002);
      return;
    }

    // Remove first-message listener; subsequent messages handled after connect
    ws.off("message", onFirstMessage);

    if (frame.type === "connect_saved") {
      handleConnectSaved(frame);
    } else {
      handleConnect(frame);
    }
  }

  ws.on("message", onFirstMessage);

  // ------------------------------------------------------------------
  // Handle connect_saved frame — fetch credentials from DB server-side
  // ------------------------------------------------------------------
  async function handleConnectSaved(frame: ConnectSavedFrame): Promise<void> {
    // For real instances verify ownership and resolve the default IP.
    // Custom instances have no DB row — host comes entirely from host_override.
    let instanceIp: string | null = null;
    if (frame.instanceId !== "__custom__") {
      const instance = await getInstanceForUser(supabase, userId, frame.instanceId);
      if (!instance || !instance.ip_public) {
        sendStatus(ws, {
          type: "status",
          status: "error",
          message: "Instance not found or has no public IP",
        });
        ws.close(1008);
        return;
      }
      instanceIp = instance.ip_public;
    }

    // Fetch saved credentials directly via the authenticated supabase client
    const { data: credRow, error: credErr } = await supabase
      .from("instance_ssh_credential")
      .select("*")
      .eq("instance_id", frame.instanceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (credErr || !credRow) {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message:
          "No SSH credentials saved for this instance. Save them in the VPS terminal (/dashboard/vps/terminal) first.",
      });
      ws.close(1008);
      return;
    }

    const row = credRow as {
      username: string;
      port: number;
      auth_method: "password" | "key";
      password_enc: string | null;
      private_key_enc: string | null;
      passphrase_enc: string | null;
      host_override: string | null;
    };

    const resolvedHost = row.host_override ?? instanceIp;
    if (!resolvedHost) {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message: "No host address found for this instance. Please reconnect via the SSH terminal and save credentials.",
      });
      ws.close(1008);
      return;
    }

    const host = resolvedHost;

    const connectFrame: ConnectFrame = {
      type: "connect",
      instanceId: frame.instanceId,
      host,
      port: row.port,
      username: row.username,
      authMethod: row.auth_method,
      cols: frame.cols,
      rows: frame.rows,
    };

    try {
      if (row.auth_method === "password" && row.password_enc) {
        connectFrame.password = decryptString(row.password_enc);
      } else if (row.auth_method === "key" && row.private_key_enc) {
        connectFrame.privateKey = decryptString(row.private_key_enc);
        if (row.passphrase_enc) {
          connectFrame.passphrase = decryptString(row.passphrase_enc);
        }
      }
    } catch {
      sendStatus(ws, {
        type: "status",
        status: "error",
        message: "Failed to decrypt saved credentials.",
      });
      ws.close(1011);
      return;
    }

    handleConnect(connectFrame);
  }

  // ------------------------------------------------------------------
  // Handle connect frame
  // ------------------------------------------------------------------
  async function handleConnect(frame: ConnectFrame): Promise<void> {
    // For real instances verify ownership and host match;
    // custom instances are user-supplied so we trust the saved credentials.
    if (frame.instanceId !== "__custom__") {
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
    }

    sendStatus(ws, { type: "status", status: "connecting" });

    // Track whether the host verifier already sent an error so the generic
    // ssh2 "Host denied" error event does not overwrite the specific reason.
    let hostRejected = false;

    // Build ssh2 connect config
    const connectConfig: Parameters<Client["connect"]>[0] = {
      host: frame.host,
      port: frame.port,
      username: frame.username,
      readyTimeout: 20_000,
      keepaliveInterval: 10_000,
      // Skip TOFU host-key pinning for custom instances (no instance row in DB)
      ...(frame.instanceId !== "__custom__" && {
        hostVerifier: makeHostVerifier({
          supabase,
          instanceId: frame.instanceId,
          userId,
          onReject: (reason) => {
            hostRejected = true;
            sendStatus(ws, {
              type: "status",
              status: "error",
              message: `SSH host key rejected: ${reason}`,
            });
          },
        }),
      }),
    };

    if (frame.authMethod === "password") {
      if (frame.password) {
        connectConfig.password = frame.password;
      } else {
        // No password in frame — use saved credential.
        const saved = await loadSavedSecrets(supabase, userId, frame.instanceId);
        if (!saved?.password) {
          sendStatus(ws, {
            type: "status",
            status: "error",
            message: "Password is required. No saved credential found for this instance.",
          });
          ws.close(1008);
          return;
        }
        connectConfig.password = saved.password;
      }
    } else {
      if (frame.privateKey) {
        connectConfig.privateKey = Buffer.from(frame.privateKey);
        if (frame.passphrase) connectConfig.passphrase = frame.passphrase;
      } else {
        // No key in frame — use saved credential.
        const saved = await loadSavedSecrets(supabase, userId, frame.instanceId);
        if (!saved?.privateKey) {
          sendStatus(ws, {
            type: "status",
            status: "error",
            message: "Private key is required. No saved credential found for this instance.",
          });
          ws.close(1008);
          return;
        }
        connectConfig.privateKey = Buffer.from(saved.privateKey);
        if (saved.passphrase) connectConfig.passphrase = saved.passphrase;
      }
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
      if (!hostRejected) {
        sendStatus(ws, {
          type: "status",
          status: "error",
          message: `SSH error: ${err.message}`,
        });
      }
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
