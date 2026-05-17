import { callTencent, TencentCredentials } from "@/lib/server/tencent/client";

export type TencentInstance = {
  InstanceId: string;
  InstanceName: string;
  InstanceState: string;
  CPU?: number;
  Memory?: number;
  OsName?: string;
  Zone?: string;
  PublicAddresses?: string[];
  PrivateAddresses?: string[];
  SystemDisk?: { DiskSize?: number };
  InternetAccessible?: { InternetMaxBandwidthOut?: number };
  ExpiredTime?: string;
  CreatedTime?: string;
};

export type NormalizedInstance = {
  externalInstanceId: string;
  name: string;
  status: string;
  region: string;
  zone: string | null;
  ipPublic: string | null;
  ipPrivate: string | null;
  cpu: number | null;
  memoryGb: number | null;
  systemDiskGb: number | null;
  bandwidthMbps: number | null;
  osName: string | null;
  expiresAt: string | null;
};

export function normalizeInstanceStatus(state: string) {
  const upper = String(state || "").toUpperCase();
  if (!upper) return "UNKNOWN";
  return upper;
}

export function normalizeInstance(instance: TencentInstance, region: string): NormalizedInstance {
  return {
    externalInstanceId: instance.InstanceId,
    name: instance.InstanceName || instance.InstanceId,
    status: normalizeInstanceStatus(instance.InstanceState),
    region,
    zone: instance.Zone || null,
    ipPublic: instance.PublicAddresses?.[0] || null,
    ipPrivate: instance.PrivateAddresses?.[0] || null,
    cpu: instance.CPU ?? null,
    memoryGb: instance.Memory ?? null,
    systemDiskGb: instance.SystemDisk?.DiskSize ?? null,
    bandwidthMbps: instance.InternetAccessible?.InternetMaxBandwidthOut ?? null,
    osName: instance.OsName || null,
    expiresAt: instance.ExpiredTime || null,
  };
}

export async function describeInstances(creds: TencentCredentials, params?: Record<string, unknown>) {
  const response = await callTencent<{ InstanceSet?: TencentInstance[]; TotalCount?: number }>(
    "DescribeInstances",
    { Offset: 0, Limit: 100, ...params },
    creds
  );
  return response.InstanceSet ?? [];
}

export async function describeRegions(creds: TencentCredentials) {
  const response = await callTencent<{ RegionSet?: Array<Record<string, unknown>> }>(
    "DescribeRegions",
    {},
    creds
  );
  return response.RegionSet ?? [];
}

export async function describeZones(creds: TencentCredentials) {
  const response = await callTencent<{ ZoneSet?: Array<Record<string, unknown>> }>(
    "DescribeZones",
    {},
    creds
  );
  return response.ZoneSet ?? [];
}

export async function describeBlueprints(creds: TencentCredentials) {
  const response = await callTencent<{ BlueprintSet?: Array<Record<string, unknown>> }>(
    "DescribeBlueprints",
    {
      Filters: [{ Name: "platform-type", Values: ["LINUX_UNIX"] }],
      Limit: 100,
      Offset: 0,
    },
    creds
  );
  return response.BlueprintSet ?? [];
}

export async function describeBundles(creds: TencentCredentials, zones: string[] = []) {
  const payload: Record<string, unknown> = {
    Offset: 0,
    Limit: 100,
    Filters: [{ Name: "support-platform-type", Values: ["LINUX_UNIX"] }],
  };
  if (zones.length) payload.Zones = zones;

  const response = await callTencent<{ BundleSet?: Bundle[] }>(
    "DescribeBundles",
    payload,
    creds
  );
  return response.BundleSet ?? [];
}

export async function createInstance(
  creds: TencentCredentials,
  payload: {
    bundleId: string;
    blueprintId: string;
    instanceName: string;
    zone?: string | null;
    password?: string;
    keyId?: string;
  }
) {
  const createPayload: Record<string, unknown> = {
    BundleId: payload.bundleId,
    BlueprintId: payload.blueprintId,
    InstanceName: payload.instanceName,
    InstanceCount: 1,
    InstanceChargePrepaid: {
      Period: 1,
      RenewFlag: "NOTIFY_AND_AUTO_RENEW",
    },
  };
  if (payload.zone) createPayload.Zones = [payload.zone];
  const loginConfiguration = buildLoginConfiguration(payload.password, payload.keyId);
  if (loginConfiguration) createPayload.LoginConfiguration = loginConfiguration;
  const response = await callTencent<{ InstanceIdSet?: string[]; RequestId?: string }>(
    "CreateInstances",
    createPayload,
    creds
  );
  return {
    instanceIds: response.InstanceIdSet ?? [],
    requestId: response.RequestId,
  };
}

export async function runInstanceAction(
  creds: TencentCredentials,
  action: "StartInstances" | "StopInstances" | "RebootInstances",
  externalInstanceId: string
) {
  const response = await callTencent<{ RequestId?: string }>(
    action,
    { InstanceIds: [externalInstanceId] },
    creds
  );
  return response.RequestId;
}

export async function resetInstancePassword(
  creds: TencentCredentials,
  externalInstanceId: string,
  password: string,
  username: string
) {
  const response = await callTencent<{ RequestId?: string }>(
    "ResetInstancesPassword",
    { InstanceIds: [externalInstanceId], Password: password, UserName: username },
    creds
  );
  return response.RequestId;
}

export async function reinstallInstance(
  creds: TencentCredentials,
  externalInstanceId: string,
  blueprintId: string,
  password?: string,
  keyId?: string
) {
  const payload: Record<string, unknown> = {
    InstanceId: externalInstanceId,
    BlueprintId: blueprintId,
  };
  const loginConfiguration = buildLoginConfiguration(password, keyId);
  if (loginConfiguration) payload.LoginConfiguration = loginConfiguration;
  const response = await callTencent<{ RequestId?: string }>("ResetInstance", payload, creds);
  return response.RequestId;
}

function buildLoginConfiguration(password?: string, keyId?: string) {
  if (!password && !keyId) return undefined;
  if (password && keyId) {
    throw new Error("Password and SSH key cannot be used together.");
  }

  if (password) {
    return {
      AutoGeneratePassword: "NO",
      Password: password,
    };
  }

  return {
    KeyIds: [keyId],
  };
}

export type TrafficPackageInfo = {
  TrafficUsed: number;
  TrafficPackageTotal: number;
  TrafficPackageRemaining: number;
  TrafficOverflow: number;
  StartTime: string;
  EndTime: string;
  Status: string;
};

export type BundlePrice = {
  Price: string;
};

export type Bundle = {
  BundleId: string;
  BundleName?: string;
  BundlePrice?: BundlePrice;
  CPU?: number;
  Memory?: number;
  SystemDiskType?: string;
  SystemDiskSize?: number;
  InternetMaxBandwidthOut?: number;
  [key: string]: unknown;
};

export async function describeTrafficPackages(
  creds: TencentCredentials,
  instanceIds: string[]
) {
  const response = await callTencent<{
    InstanceTrafficPackageSet?: Array<{
      InstanceId: string;
      TrafficPackageSet?: TrafficPackageInfo[];
    }>;
  }>("DescribeInstancesTrafficPackages", { InstanceIds: instanceIds }, creds);
  return response.InstanceTrafficPackageSet ?? [];
}

export async function describeFirewallRules(creds: TencentCredentials, externalInstanceId: string) {
  const response = await callTencent<{ FirewallRuleSet?: Array<Record<string, unknown>> }>(
    "DescribeFirewallRules",
    { InstanceId: externalInstanceId },
    creds
  );
  return response.FirewallRuleSet ?? [];
}

export async function createFirewallRule(
  creds: TencentCredentials,
  externalInstanceId: string,
  rule: { protocol: string; port: string; cidrBlock: string; action: string; description?: string }
) {
  const response = await callTencent<{ RequestId?: string }>(
    "CreateFirewallRules",
    {
      InstanceId: externalInstanceId,
      FirewallRules: [
        {
          Protocol: rule.protocol,
          Port: rule.port,
          CidrBlock: rule.cidrBlock,
          Action: rule.action,
          FirewallRuleDescription: rule.description || "",
        },
      ],
    },
    creds
  );
  return response.RequestId;
}

export async function deleteFirewallRule(
  creds: TencentCredentials,
  externalInstanceId: string,
  input:
    | { firewallRuleId: string }
    | {
        rule: {
          protocol: string;
          port: string;
          cidrBlock: string;
          action: string;
          description?: string;
        };
      }
) {
  const payload =
    "firewallRuleId" in input
      ? { InstanceId: externalInstanceId, FirewallRuleIds: [input.firewallRuleId] }
      : {
          InstanceId: externalInstanceId,
          FirewallRules: [
            {
              Protocol: input.rule.protocol,
              Port: input.rule.port,
              CidrBlock: input.rule.cidrBlock,
              Action: input.rule.action,
              FirewallRuleDescription: input.rule.description || "",
            },
          ],
        };
  const response = await callTencent<{ RequestId?: string }>(
    "DeleteFirewallRules",
    payload,
    creds
  );
  return response.RequestId;
}

export async function describeKeyPairs(creds: TencentCredentials) {
  const response = await callTencent<{ KeyPairSet?: KeyPair[] }>(
    "DescribeKeyPairs",
    { Limit: 100, Offset: 0 },
    creds
  );
  return response.KeyPairSet ?? [];
}

export type KeyPair = {
  KeyId?: string;
  KeyName?: string;
  PublicKey?: string;
  AssociatedInstanceIds?: string[];
  CreatedTime?: string;
};

export async function importKeyPair(
  creds: TencentCredentials,
  keyName: string,
  publicKey: string
) {
  const response = await callTencent<{ KeyId?: string; RequestId?: string }>(
    "ImportKeyPair",
    { KeyName: keyName, PublicKey: publicKey },
    creds
  );
  return response;
}

export async function createKeyPair(creds: TencentCredentials, keyName: string) {
  const response = await callTencent<{ KeyId?: string; PrivateKey?: string; RequestId?: string }>(
    "CreateKeyPair",
    { KeyName: keyName },
    creds
  );
  return response;
}

export async function associateKeyPair(
  creds: TencentCredentials,
  externalInstanceId: string,
  keyId: string
) {
  const response = await callTencent<{ RequestId?: string }>(
    "AssociateInstancesKeyPairs",
    { InstanceIds: [externalInstanceId], KeyIds: [keyId] },
    creds
  );
  return response.RequestId;
}

export async function disassociateKeyPair(
  creds: TencentCredentials,
  externalInstanceId: string,
  keyId: string
) {
  const response = await callTencent<{ RequestId?: string }>(
    "DisassociateInstancesKeyPairs",
    { InstanceIds: [externalInstanceId], KeyIds: [keyId] },
    creds
  );
  return response.RequestId;
}

export async function deleteKeyPair(
  creds: TencentCredentials,
  keyId: string
) {
  const response = await callTencent<{ RequestId?: string }>(
    "DeleteKeyPairs",
    { KeyIds: [keyId] },
    creds
  );
  return response.RequestId;
}
