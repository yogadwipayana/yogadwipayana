import { cookies } from "next/headers";

import { decryptString, encryptString } from "@/lib/server/crypto";
import { createClient } from "@/utils/supabase/server";
import {
  associateKeyPair,
  createFirewallRule,
  createKeyPair,
  deleteKeyPair,
  deleteFirewallRule,
  describeBlueprints,
  describeBundles,
  describeFirewallRules,
  describeInstances,
  describeKeyPairs,
  describeRegions,
  describeTrafficPackages,
  describeZones,
  disassociateKeyPair,
  importKeyPair,
  normalizeInstance,
  reinstallInstance,
  resetInstancePassword,
  runInstanceAction,
  type NormalizedInstance,
  type KeyPair,
  type TrafficPackageInfo,
} from "@/lib/server/tencent/service";
import type { TencentCredentials } from "@/lib/server/tencent/client";
import { ApiError } from "@/lib/server/api-response";

type InstanceRow = {
  id: string;
  user_id: string;
  provider: string;
  external_instance_id: string;
  name: string;
  region: string;
  zone: string | null;
  status: string;
  provider_status: string;
  secret_id_enc: string | null;
  secret_key_enc: string | null;
  ip_public: string | null;
  ip_private: string | null;
  cpu: number | null;
  memory_gb: number | null;
  system_disk_gb: number | null;
  bandwidth_mbps: number | null;
  os_name: string | null;
  expires_at: string | null;
  expires_at_overridden: boolean;
  source: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

async function sb() {
  return createClient(await cookies());
}

export function decodeInstanceCreds(
  instance: Pick<InstanceRow, "secret_id_enc" | "secret_key_enc" | "region">,
): TencentCredentials {
  return {
    secretId: decryptString(instance.secret_id_enc as string),
    secretKey: decryptString(instance.secret_key_enc as string),
    region: instance.region,
  };
}

async function getCredentialSourceInstance(userId: string) {
  const client = await sb();
  const { data, error } = await client
    .from("instance")
    .select("*")
    .eq("user_id", userId)
    .not("secret_id_enc", "is", null)
    .not("secret_key_enc", "is", null)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as InstanceRow | null) ?? null;
}

/**
 * Get Tencent credentials for a user.
 * Tries the user's BYOK instance first, then falls back to TENCENT_* env vars.
 */
export async function getCredentials(userId: string): Promise<TencentCredentials> {
  const instance = await getCredentialSourceInstance(userId);
  if (instance) return decodeInstanceCreds(instance);

  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;
  const region = process.env.TENCENT_DEFAULT_REGION || "ap-jakarta";

  if (secretId && secretKey) return { secretId, secretKey, region };

  throw new ApiError(
    400,
    "CLOUD_ACCOUNT_REQUIRED",
    "No Tencent Cloud credentials available. Please connect a BYOK account or contact the administrator.",
  );
}

export async function upsertInstance(
  userId: string,
  source: "order" | "byok_import",
  instance: NormalizedInstance,
  credentials?: { secretId?: string; secretKey?: string },
  options?: { reactivate?: boolean },
) {
  const client = await sb();
  const secretIdEnc = credentials?.secretId ? encryptString(credentials.secretId) : null;
  const secretKeyEnc = credentials?.secretKey ? encryptString(credentials.secretKey) : null;

  // Read existing row (if any) so we can preserve credentials we're not
  // explicitly overwriting and respect admin overrides on status / expiry.
  const { data: existing } = await client
    .from("instance")
    .select("*")
    .eq("provider", "tencent_lighthouse")
    .eq("external_instance_id", instance.externalInstanceId)
    .eq("user_id", userId)
    .maybeSingle();

  const existingRow = existing as InstanceRow | null;
  const nowIso = new Date().toISOString();

  // Background sync must not revive a row the user has removed (status='inactive').
  // An explicit user-triggered import (reactivate=true) should re-activate it.
  const nextStatus =
    existingRow?.status === "inactive" && !options?.reactivate ? "inactive" : "active";

  // Give brand-new rows a sort_order at the end of the user's list. Existing
  // rows keep their current order so reorders the user has made aren't reset
  // by background sync.
  let nextSortOrder: number | undefined;
  if (!existingRow) {
    const { data: maxRow } = await client
      .from("instance")
      .select("sort_order")
      .eq("user_id", userId)
      .order("sort_order", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const maxSort = (maxRow as { sort_order: number | null } | null)?.sort_order ?? 0;
    nextSortOrder = maxSort + 1000;
  }

  const row = {
    user_id: userId,
    provider: "tencent_lighthouse" as const,
    external_instance_id: instance.externalInstanceId,
    name: instance.name,
    region: instance.region,
    zone: instance.zone,
    status: nextStatus,
    ...(nextSortOrder !== undefined ? { sort_order: nextSortOrder } : {}),
    provider_status: instance.status,
    secret_id_enc: secretIdEnc ?? existingRow?.secret_id_enc ?? null,
    secret_key_enc: secretKeyEnc ?? existingRow?.secret_key_enc ?? null,
    ip_public: instance.ipPublic,
    ip_private: instance.ipPrivate,
    cpu: instance.cpu,
    memory_gb: instance.memoryGb,
    system_disk_gb: instance.systemDiskGb,
    bandwidth_mbps: instance.bandwidthMbps,
    os_name: instance.osName,
    expires_at: existingRow?.expires_at_overridden
      ? existingRow.expires_at
      : instance.expiresAt,
    source,
    last_synced_at: nowIso,
  };

  const { data, error } = await client
    .from("instance")
    .upsert(row, { onConflict: "provider,external_instance_id,user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as InstanceRow;
}

export async function listUserInstances(userId: string) {
  const client = await sb();
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("instance")
    .select(
      "id, user_id, provider, external_instance_id, name, region, zone, provider_status, ip_public, ip_private, cpu, memory_gb, system_disk_gb, bandwidth_mbps, os_name, expires_at, source, last_synced_at, created_at, updated_at",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  // The legacy SQL returned `provider_status as status`; mirror that so
  // downstream consumers that read .status keep working.
  return ((data ?? []) as Array<Omit<InstanceRow, "status">>).map((r) => ({
    ...r,
    status: r.provider_status,
  })) as InstanceRow[];
}

export async function getUserInstanceById(userId: string, id: string) {
  const client = await sb();
  const nowIso = new Date().toISOString();
  const { data, error } = await client
    .from("instance")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();
  if (error) throw error;
  return (data as InstanceRow | null) ?? null;
}

export async function removeUserInstance(userId: string, id: string) {
  const instance = await getUserInstanceById(userId, id);
  if (!instance) {
    throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  }
  const client = await sb();
  const { error } = await client
    .from("instance")
    .update({
      status: "inactive",
      secret_id_enc: null,
      secret_key_enc: null,
    })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return { removed: true, id };
}

export async function reorderUserInstances(userId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) return { reordered: 0 };

  const client = await sb();

  // Validate every id belongs to this user before touching anything. Without
  // this check a malicious client could reset another user's sort_order via
  // the unique-constraint-free UPDATE below.
  const { data: owned, error: ownErr } = await client
    .from("instance")
    .select("id")
    .eq("user_id", userId)
    .in("id", orderedIds);
  if (ownErr) throw ownErr;
  const ownedSet = new Set(((owned ?? []) as Array<{ id: string }>).map((r) => r.id));
  const invalid = orderedIds.filter((id) => !ownedSet.has(id));
  if (invalid.length > 0) {
    throw new ApiError(
      404,
      "INSTANCE_NOT_FOUND",
      `Instances not found or not owned by user: ${invalid.join(", ")}`,
    );
  }

  // Sparse spacing keeps room for future single-row inserts between two
  // existing entries without a full renumbering.
  await Promise.all(
    orderedIds.map((id, index) =>
      client
        .from("instance")
        .update({ sort_order: (index + 1) * 1000 })
        .eq("id", id)
        .eq("user_id", userId),
    ),
  );

  return { reordered: orderedIds.length };
}

export async function syncAllInstances(userId: string) {
  const sourceInstance = await getCredentialSourceInstance(userId);
  if (!sourceInstance) return [];
  const creds = decodeInstanceCreds(sourceInstance);
  const instances = await describeInstances(creds);
  const upserted: InstanceRow[] = [];
  for (const item of instances) {
    const normalized = normalizeInstance(item, creds.region);
    const row = await upsertInstance(userId, "byok_import", normalized);
    upserted.push(row);
  }
  return upserted;
}

function serializeInstanceForDashboard(instance: InstanceRow) {
  return {
    id: instance.id,
    external_instance_id: instance.external_instance_id,
    name: instance.name,
    status: instance.provider_status,
    region: instance.region,
    zone: instance.zone,
    ip_public: instance.ip_public,
    ip_private: instance.ip_private,
    cpu: instance.cpu,
    memory_gb: instance.memory_gb,
    system_disk_gb: instance.system_disk_gb,
    bandwidth_mbps: instance.bandwidth_mbps,
    os_name: instance.os_name,
    expires_at: instance.expires_at,
    last_synced_at: instance.last_synced_at,
  };
}

async function resolveInstanceWithCreds(
  userId: string,
  instanceId: string,
  preferStored = true,
) {
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const hasStoredCredentials = Boolean(instance.secret_id_enc && instance.secret_key_enc);
  const creds =
    preferStored && hasStoredCredentials
      ? decodeInstanceCreds(instance)
      : await getCredentials(userId);
  creds.region = instance.region;
  return { instance, creds, hasStoredCredentials };
}

export async function refreshUserInstance(userId: string, instanceId: string) {
  const { instance, creds, hasStoredCredentials } = await resolveInstanceWithCreds(
    userId,
    instanceId,
    true,
  );

  const providerInstances = await describeInstances(creds, {
    InstanceIds: [instance.external_instance_id],
    Limit: 1,
    Offset: 0,
  });
  const providerInstance = providerInstances[0];
  if (!providerInstance) {
    throw new ApiError(
      404,
      "PROVIDER_INSTANCE_NOT_FOUND",
      "Tencent Cloud did not return this VPS in the selected region.",
    );
  }

  const refreshed = await upsertInstance(
    userId,
    instance.source === "order" ? "order" : "byok_import",
    normalizeInstance(providerInstance, instance.region),
    hasStoredCredentials ? { secretId: creds.secretId, secretKey: creds.secretKey } : undefined,
  );

  return refreshed;
}

export async function getInstanceDetail(
  userId: string,
  instanceId: string,
  options?: { refresh?: boolean },
) {
  const instance = options?.refresh
    ? await refreshUserInstance(userId, instanceId)
    : await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds =
    instance.secret_id_enc && instance.secret_key_enc
      ? decodeInstanceCreds(instance)
      : await getCredentials(userId);
  creds.region = instance.region;

  let trafficPackages: TrafficPackageInfo[] = [];
  try {
    const trafficData = await describeTrafficPackages(creds, [instance.external_instance_id]);
    const entry = trafficData.find((t) => t.InstanceId === instance.external_instance_id);
    trafficPackages = entry?.TrafficPackageSet ?? [];
  } catch {
    // Traffic data is non-critical; if the API fails, continue with empty data
  }

  return {
    instance: serializeInstanceForDashboard(instance),
    trafficPackages,
  };
}

export async function getCatalog(userId: string) {
  const creds = await getCredentials(userId);
  const [regions, zones, blueprints, bundles] = await Promise.all([
    describeRegions(creds),
    describeZones(creds),
    describeBlueprints(creds),
    describeBundles(creds),
  ]);
  return { region: creds.region, regions, zones, blueprints, bundles };
}

export async function performInstanceAction(input: {
  userId: string;
  instanceId: string;
  action: "start" | "stop" | "reboot";
}) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const actionMap = {
    start: "StartInstances",
    stop: "StopInstances",
    reboot: "RebootInstances",
  } as const;
  const providerAction = actionMap[input.action];

  const requestId = await runInstanceAction(creds, providerAction, instance.external_instance_id);
  return { requestId: requestId || null };
}

export async function performResetPassword(input: {
  userId: string;
  instanceId: string;
  username: string;
  password: string;
}) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const requestId = await resetInstancePassword(
    creds,
    instance.external_instance_id,
    input.password,
    input.username,
  );
  return { requestId: requestId || null };
}

export async function performReinstall(input: {
  userId: string;
  instanceId: string;
  blueprintId: string;
  password?: string;
  keyId?: string;
}) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const requestId = await reinstallInstance(
    creds,
    instance.external_instance_id,
    input.blueprintId,
    input.password,
    input.keyId,
  );
  // Reinstall changes the SSH host key — clear the pinned fingerprint so the
  // next connect re-pins instead of being rejected.
  const client = await sb();
  await client
    .from("instance")
    .update({ host_fingerprint_sha256: null })
    .eq("id", input.instanceId)
    .eq("user_id", input.userId);
  return { requestId: requestId || null };
}

export async function listFirewallRules(userId: string, instanceId: string) {
  const { instance, creds } = await resolveInstanceWithCreds(userId, instanceId);
  return describeFirewallRules(creds, instance.external_instance_id);
}

export async function addFirewallRule(input: {
  userId: string;
  instanceId: string;
  protocol: string;
  port: string;
  cidrBlock: string;
  action: string;
  description?: string;
}) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const requestId = await createFirewallRule(creds, instance.external_instance_id, {
    protocol: input.protocol,
    port: input.port,
    cidrBlock: input.cidrBlock,
    action: input.action,
    description: input.description,
  });
  return { requestId: requestId || null };
}

export async function removeFirewallRule(input: { userId: string; instanceId: string; ruleId: string }) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const requestId = await deleteFirewallRule(creds, instance.external_instance_id, {
    firewallRuleId: input.ruleId,
  });
  return { requestId: requestId || null };
}

export async function removeFirewallRuleByDefinition(input: {
  userId: string;
  instanceId: string;
  protocol: string;
  port: string;
  cidrBlock: string;
  action: string;
  description?: string;
}) {
  const { instance, creds } = await resolveInstanceWithCreds(input.userId, input.instanceId);
  const requestId = await deleteFirewallRule(creds, instance.external_instance_id, {
    rule: {
      protocol: input.protocol,
      port: input.port,
      cidrBlock: input.cidrBlock,
      action: input.action,
      description: input.description,
    },
  });
  return { requestId: requestId || null };
}

export async function listSshKeys(userId: string) {
  const creds = await getCredentials(userId);
  return describeKeyPairs(creds);
}

function getAssociatedInstanceIds(key: KeyPair | undefined) {
  return key?.AssociatedInstanceIds ?? [];
}

async function findKeyById(userId: string, keyId: string) {
  const creds = await getCredentials(userId);
  const keys = await describeKeyPairs(creds);
  const key = keys.find((item) => item.KeyId === keyId);
  if (!key) throw new ApiError(404, "SSH_KEY_NOT_FOUND", "SSH key not found");
  return { creds, key };
}

export async function createImportedSshKey(userId: string, keyName: string, publicKey: string) {
  const creds = await getCredentials(userId);
  const normalizedKeyName = normalizeTencentKeyName(keyName);
  const normalizedPublicKey = normalizePublicKey(publicKey);
  const existingKeys = await describeKeyPairs(creds);
  const existingKey = existingKeys.find(
    (item) => item.KeyId && normalizePublicKey(item.PublicKey) === normalizedPublicKey,
  );

  if (existingKey?.KeyId) {
    return {
      KeyId: existingKey.KeyId,
      KeyName: existingKey.KeyName,
      RequestId: undefined,
      reused: true,
    };
  }

  const availableKeyName = createAvailableTencentKeyName(normalizedKeyName, existingKeys);
  return importKeyPair(creds, availableKeyName, normalizedPublicKey);
}

export async function createGeneratedSshKey(userId: string, keyName: string) {
  const creds = await getCredentials(userId);
  return createKeyPair(creds, normalizeTencentKeyName(keyName));
}

export async function bindSshKeyToInstance(userId: string, instanceId: string, keyId: string) {
  const { instance, creds } = await resolveInstanceWithCreds(userId, instanceId);
  const requestId = await associateKeyPair(creds, instance.external_instance_id, keyId);
  return { requestId: requestId || null };
}

export async function unbindSshKeyFromInstance(userId: string, instanceId: string, keyId: string) {
  const { instance, creds } = await resolveInstanceWithCreds(userId, instanceId);
  const requestId = await disassociateKeyPair(creds, instance.external_instance_id, keyId);
  return { requestId: requestId || null };
}

export async function deleteSshKey(userId: string, keyId: string) {
  const { creds, key } = await findKeyById(userId, keyId);
  const associated = getAssociatedInstanceIds(key);

  if (associated.length > 0) {
    for (const externalInstanceId of associated) {
      await disassociateKeyPair(creds, externalInstanceId, keyId);
    }

    // Unbind can be async; poll briefly before deleting.
    const maxAttempts = 6;
    const delayMs = 2000;
    let stillAttached = true;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const keys = await describeKeyPairs(creds);
      const current = keys.find((item) => item.KeyId === keyId);
      if (!current) {
        stillAttached = false;
        break;
      }
      if ((current.AssociatedInstanceIds?.length ?? 0) === 0) {
        stillAttached = false;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (stillAttached) {
      throw new ApiError(
        409,
        "SSH_KEY_UNBIND_PENDING",
        "SSH key is still attached. Unbind is in progress, please try delete again shortly.",
      );
    }
  }

  const deleteRequestId = await deleteKeyPair(creds, keyId);
  return { deleted: true, keyId, deleteRequestId: deleteRequestId || null };
}

export async function replaceImportedSshKey(
  userId: string,
  keyId: string,
  keyName: string,
  publicKey: string,
) {
  const { creds, key } = await findKeyById(userId, keyId);
  const associated = getAssociatedInstanceIds(key);
  if (associated.length > 0) {
    throw new ApiError(
      409,
      "SSH_KEY_ATTACHED",
      "SSH key is attached to instances. Unbind it before editing.",
    );
  }

  await deleteKeyPair(creds, keyId);
  const created = await importKeyPair(creds, normalizeTencentKeyName(keyName), publicKey);
  return { replaced: true, oldKeyId: keyId, key: created };
}

function normalizeTencentKeyName(value: string) {
  const trimmed = value.trim();
  const normalized = trimmed
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized || "key";
  const prefixed = /^[A-Za-z]/.test(base) ? base : `key_${base}`;
  return prefixed.slice(0, 128);
}

function normalizePublicKey(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\r\n/g, "\n");
}

function createAvailableTencentKeyName(baseName: string, existingKeys: KeyPair[]) {
  const existingNames = new Set(
    existingKeys
      .map((item) => item.KeyName)
      .filter((item): item is string => Boolean(item)),
  );

  if (!existingNames.has(baseName)) return baseName;

  for (let index = 2; index < 10_000; index += 1) {
    const suffix = `_${index}`;
    const truncatedBase = baseName.slice(0, Math.max(1, 128 - suffix.length));
    const candidate = `${truncatedBase}${suffix}`;
    if (!existingNames.has(candidate)) return candidate;
  }

  throw new ApiError(
    409,
    "SSH_KEY_NAME_CONFLICT",
    "Unable to allocate a unique SSH key name. Please try a different name.",
  );
}
