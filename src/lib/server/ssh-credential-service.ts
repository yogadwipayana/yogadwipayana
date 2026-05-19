import { cookies } from "next/headers";

import { ApiError } from "@/lib/server/api-response";
import { decryptString, encryptString } from "@/lib/server/crypto";
import { getUserInstanceById } from "@/lib/server/dashboard-service";
import { createClient } from "@/utils/supabase/server";

export type SshAuthMethod = "password" | "key";

export type SshCredential = {
  instanceId: string;
  userId: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  hostOverride?: string;
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  updatedAt: string;
};

type CredentialRow = {
  instance_id: string;
  user_id: string;
  username: string;
  port: number;
  auth_method: SshAuthMethod;
  password_enc: string | null;
  private_key_enc: string | null;
  passphrase_enc: string | null;
  host_override: string | null;
  created_at: string;
  updated_at: string;
};

async function sb() {
  return createClient(await cookies());
}

async function ensureInstanceOwned(userId: string, instanceId: string) {
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) {
    throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  }
  return instance;
}

function toSafe(row: CredentialRow): SshCredential {
  return {
    instanceId: row.instance_id,
    userId: row.user_id,
    username: row.username,
    port: row.port,
    authMethod: row.auth_method,
    hostOverride: row.host_override ?? undefined,
    hasPassword: row.password_enc !== null,
    hasPrivateKey: row.private_key_enc !== null,
    hasPassphrase: row.passphrase_enc !== null,
    updatedAt: row.updated_at,
  };
}

function toDecrypted(row: CredentialRow): SshCredential {
  const safe = toSafe(row);
  if (row.password_enc) safe.password = decryptString(row.password_enc);
  if (row.private_key_enc) safe.privateKey = decryptString(row.private_key_enc);
  if (row.passphrase_enc) safe.passphrase = decryptString(row.passphrase_enc);
  return safe;
}

export async function getSshCredential(
  userId: string,
  instanceId: string,
  mode: "safe" | "decrypt" = "safe",
): Promise<SshCredential | null> {
  await ensureInstanceOwned(userId, instanceId);
  const client = await sb();
  const { data, error } = await client
    .from("instance_ssh_credential")
    .select("*")
    .eq("instance_id", instanceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as CredentialRow;
  return mode === "decrypt" ? toDecrypted(row) : toSafe(row);
}

export async function upsertSshCredential(input: {
  userId: string;
  instanceId: string;
  username: string;
  port: number;
  authMethod: SshAuthMethod;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  hostOverride?: string;
}): Promise<SshCredential> {
  const username = input.username.trim();
  if (username.length < 1 || username.length > 50) {
    throw new ApiError(400, "INVALID_INPUT", "Username must be 1–50 characters");
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    throw new ApiError(400, "INVALID_INPUT", "Port must be 1–65535");
  }
  if (input.authMethod === "password") {
    if (!input.password || input.password.length === 0) {
      throw new ApiError(400, "INVALID_INPUT", "Password is required for password auth");
    }
  } else if (input.authMethod === "key") {
    if (!input.privateKey || input.privateKey.trim().length === 0) {
      throw new ApiError(400, "INVALID_INPUT", "Private key is required for key auth");
    }
  } else {
    throw new ApiError(400, "INVALID_INPUT", "Invalid auth method");
  }

  await ensureInstanceOwned(input.userId, input.instanceId);

  const passwordEnc =
    input.authMethod === "password" && input.password
      ? encryptString(input.password)
      : null;
  const privateKeyEnc =
    input.authMethod === "key" && input.privateKey
      ? encryptString(input.privateKey)
      : null;
  const passphraseEnc =
    input.authMethod === "key" && input.passphrase
      ? encryptString(input.passphrase)
      : null;
  const hostOverride =
    input.hostOverride && input.hostOverride.trim().length > 0
      ? input.hostOverride.trim()
      : null;

  const client = await sb();
  const { data, error } = await client
    .from("instance_ssh_credential")
    .upsert(
      {
        instance_id: input.instanceId,
        user_id: input.userId,
        username,
        port: input.port,
        auth_method: input.authMethod,
        password_enc: passwordEnc,
        private_key_enc: privateKeyEnc,
        passphrase_enc: passphraseEnc,
        host_override: hostOverride,
      },
      { onConflict: "instance_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return toSafe(data as CredentialRow);
}

export async function deleteSshCredential(
  userId: string,
  instanceId: string,
): Promise<void> {
  await ensureInstanceOwned(userId, instanceId);
  const client = await sb();
  const { error } = await client
    .from("instance_ssh_credential")
    .delete()
    .eq("instance_id", instanceId)
    .eq("user_id", userId);
  if (error) throw error;
}
