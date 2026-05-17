import { decryptString, encryptString } from "@/lib/server/crypto";
import { query } from "@/lib/server/db";
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
  source: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  const result = await query<InstanceRow>(
    `select *
     from instance
     where user_id = $1
       and secret_id_enc is not null
       and secret_key_enc is not null
     order by updated_at desc, created_at desc
     limit 1`,
    [userId],
  );
  return result.rows[0] ?? null;
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
) {
  const secretIdEnc = credentials?.secretId ? encryptString(credentials.secretId) : null;
  const secretKeyEnc = credentials?.secretKey ? encryptString(credentials.secretKey) : null;

  const result = await query<InstanceRow>(
    `insert into instance (
      user_id, provider, external_instance_id, name, region, zone, status, provider_status,
      secret_id_enc, secret_key_enc,
      ip_public, ip_private, cpu, memory_gb, system_disk_gb, bandwidth_mbps,
      os_name, expires_at, source, last_synced_at
    ) values (
      $1, 'tencent_lighthouse', $2, $3, $4, $5, 'active', $6,
      $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17, now()
    )
    on conflict (provider, external_instance_id, user_id)
    do update set
      name = excluded.name,
      region = excluded.region,
      zone = excluded.zone,
      status = case
        when instance.status = 'inactive' then instance.status
        else 'active'
      end,
      provider_status = excluded.provider_status,
      secret_id_enc = coalesce(excluded.secret_id_enc, instance.secret_id_enc),
      secret_key_enc = coalesce(excluded.secret_key_enc, instance.secret_key_enc),
      ip_public = excluded.ip_public,
      ip_private = excluded.ip_private,
      cpu = excluded.cpu,
      memory_gb = excluded.memory_gb,
      system_disk_gb = excluded.system_disk_gb,
      bandwidth_mbps = excluded.bandwidth_mbps,
      os_name = excluded.os_name,
      expires_at = case
        when instance.expires_at_overridden then instance.expires_at
        else excluded.expires_at
      end,
      source = excluded.source,
      last_synced_at = now(),
      updated_at = now()
    returning *`,
    [
      userId,
      instance.externalInstanceId,
      instance.name,
      instance.region,
      instance.zone,
      instance.status,
      secretIdEnc,
      secretKeyEnc,
      instance.ipPublic,
      instance.ipPrivate,
      instance.cpu,
      instance.memoryGb,
      instance.systemDiskGb,
      instance.bandwidthMbps,
      instance.osName,
      instance.expiresAt,
      source,
    ],
  );
  return result.rows[0];
}

export async function listUserInstances(userId: string) {
  const result = await query<InstanceRow>(
    `select
      id, user_id, provider, external_instance_id, name, region, zone,
      provider_status as status, provider_status,
      ip_public, ip_private, cpu, memory_gb, system_disk_gb, bandwidth_mbps,
      os_name, expires_at, source, last_synced_at, created_at, updated_at
     from instance
     where user_id = $1
       and status = 'active'
       and (expires_at is null or expires_at > now())
     order by created_at desc`,
    [userId],
  );
  return result.rows;
}

export async function getUserInstanceById(userId: string, id: string) {
  const result = await query<InstanceRow>(
    `select *
     from instance
     where id = $1
       and user_id = $2
       and status = 'active'
       and (expires_at is null or expires_at > now())
     limit 1`,
    [id, userId],
  );
  return result.rows[0] ?? null;
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

export async function refreshUserInstance(userId: string, instanceId: string) {
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const hasStoredCredentials = Boolean(instance.secret_id_enc && instance.secret_key_enc);
  const creds = hasStoredCredentials ? decodeInstanceCreds(instance) : await getCredentials(userId);
  creds.region = instance.region;

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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
  const requestId = await reinstallInstance(
    creds,
    instance.external_instance_id,
    input.blueprintId,
    input.password,
    input.keyId,
  );
  return { requestId: requestId || null };
}

export async function listFirewallRules(userId: string, instanceId: string) {
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(input.userId, input.instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(input.userId);
  creds.region = instance.region;
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
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(userId);
  creds.region = instance.region;
  const requestId = await associateKeyPair(creds, instance.external_instance_id, keyId);
  return { requestId: requestId || null };
}

export async function unbindSshKeyFromInstance(userId: string, instanceId: string, keyId: string) {
  const instance = await getUserInstanceById(userId, instanceId);
  if (!instance) throw new ApiError(404, "INSTANCE_NOT_FOUND", "Instance not found");
  const creds = await getCredentials(userId);
  creds.region = instance.region;
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
