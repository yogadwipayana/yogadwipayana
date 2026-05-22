import { cookies } from "next/headers";
import { Client } from "ssh2";

import { getUserInstanceById } from "@/lib/server/dashboard-service";
import { getSshCredential } from "@/lib/server/ssh-credential-service";
import { makeHostVerifier } from "@/lib/server/ssh-host-pin";
import { createClient } from "@/utils/supabase/server";

export type SshExecResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  truncated: boolean;
  durationMs: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 16_384;
const MAX_OUTPUT_BYTES_LIMIT = 65_536;

export async function sshExec(input: {
  userId: string;
  instanceId: string;
  command: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}): Promise<SshExecResult> {
  const {
    userId,
    instanceId,
    command,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  } = input;

  const clampedTimeout = Math.min(MAX_TIMEOUT_MS, Math.max(1_000, timeoutMs));
  const clampedMaxBytes = Math.min(
    MAX_OUTPUT_BYTES_LIMIT,
    Math.max(1, maxOutputBytes),
  );

  const credential = await getSshCredential(userId, instanceId, "decrypt");
  if (!credential) {
    throw new Error(
      "No SSH credentials saved for this instance. Direct the user to save them at [SSH Terminal](/dashboard/vps/terminal) — render that as a clickable Markdown link, not inline code.",
    );
  }

  let host: string;
  if (instanceId === "__custom__") {
    if (!credential.hostOverride) {
      throw new Error(
        "Custom instance has no host address saved. Ask the user to reconnect at [SSH Terminal](/dashboard/vps/terminal) and save credentials again.",
      );
    }
    host = credential.hostOverride;
  } else {
    const instance = await getUserInstanceById(userId, instanceId);
    if (!instance || !instance.ip_public) {
      throw new Error("Instance not found or has no public IP");
    }
    host = credential.hostOverride ?? instance.ip_public;
  }

  const supabase = instanceId !== "__custom__" ? createClient(await cookies()) : null;

  return new Promise<SshExecResult>((resolve, reject) => {
    const conn = new Client();
    const startMs = Date.now();
    let settled = false;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;

    function finish(result: SshExecResult) {
      if (settled) return;
      settled = true;
      if (hardTimer !== null) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
      conn.end();
      resolve(result);
    }

    conn.on("error", (err: Error) => {
      if (settled) return;
      settled = true;
      if (hardTimer !== null) {
        clearTimeout(hardTimer);
        hardTimer = null;
      }
      reject(err);
    });

    conn.on("ready", () => {
      hardTimer = setTimeout(() => {
        finish({
          ok: false,
          stdout: "",
          stderr: "Command timed out",
          exitCode: null,
          signal: null,
          truncated: false,
          durationMs: Date.now() - startMs,
        });
      }, clampedTimeout);

      conn.exec(command, (err, channel) => {
        if (err) {
          if (settled) return;
          settled = true;
          if (hardTimer !== null) {
            clearTimeout(hardTimer);
            hardTimer = null;
          }
          conn.end();
          reject(err);
          return;
        }

        const stdoutChunks: Buffer[] = [];
        const stderrChunks: Buffer[] = [];
        let stdoutBytes = 0;
        let stderrBytes = 0;
        let truncated = false;

        channel.on("data", (chunk: Buffer) => {
          if (stdoutBytes < clampedMaxBytes) {
            const remaining = clampedMaxBytes - stdoutBytes;
            if (chunk.length > remaining) {
              stdoutChunks.push(chunk.subarray(0, remaining));
              stdoutBytes += remaining;
              truncated = true;
            } else {
              stdoutChunks.push(chunk);
              stdoutBytes += chunk.length;
            }
          } else {
            truncated = true;
          }
        });

        channel.stderr.on("data", (chunk: Buffer) => {
          if (stderrBytes < clampedMaxBytes) {
            const remaining = clampedMaxBytes - stderrBytes;
            if (chunk.length > remaining) {
              stderrChunks.push(chunk.subarray(0, remaining));
              stderrBytes += remaining;
              truncated = true;
            } else {
              stderrChunks.push(chunk);
              stderrBytes += chunk.length;
            }
          } else {
            truncated = true;
          }
        });

        channel.on("close", (code: number | null, signal: string | null) => {
          finish({
            ok: code === 0,
            stdout: Buffer.concat(stdoutChunks).toString("utf8"),
            stderr: Buffer.concat(stderrChunks).toString("utf8"),
            exitCode: code,
            signal: signal ?? null,
            truncated,
            durationMs: Date.now() - startMs,
          });
        });
      });
    });

    const connectConfig: Parameters<Client["connect"]>[0] = {
      host,
      port: credential.port,
      username: credential.username,
      readyTimeout: 10_000,
      // Skip TOFU host-key pinning for custom instances (no instance row in DB)
      ...(supabase && {
        hostVerifier: makeHostVerifier({ supabase, instanceId, userId }),
      }),
    };

    if (credential.authMethod === "password" && credential.password) {
      connectConfig.password = credential.password;
    } else if (credential.authMethod === "key" && credential.privateKey) {
      connectConfig.privateKey = Buffer.from(credential.privateKey);
      if (credential.passphrase) {
        connectConfig.passphrase = credential.passphrase;
      }
    }

    conn.connect(connectConfig);
  });
}
