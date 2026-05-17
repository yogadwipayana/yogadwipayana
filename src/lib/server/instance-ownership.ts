export type OwnershipTransferInput = {
  sourceUserId: string;
  targetUserId: string;
};

export type OwnershipInstanceRecord = {
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
};

export type ClonedInstanceData = Omit<OwnershipInstanceRecord, "id">;

export function validateOwnershipTransferInput(input: OwnershipTransferInput) {
  if (input.sourceUserId === input.targetUserId) {
    throw new Error("Cannot transfer VPS to the same user");
  }
}

export function buildClonedInstanceData(
  instance: OwnershipInstanceRecord,
  targetUserId: string,
): ClonedInstanceData {
  return {
    user_id: targetUserId,
    provider: instance.provider,
    external_instance_id: instance.external_instance_id,
    name: instance.name,
    region: instance.region,
    zone: instance.zone,
    status: instance.status,
    provider_status: instance.provider_status,
    secret_id_enc: instance.secret_id_enc,
    secret_key_enc: instance.secret_key_enc,
    ip_public: instance.ip_public,
    ip_private: instance.ip_private,
    cpu: instance.cpu,
    memory_gb: instance.memory_gb,
    system_disk_gb: instance.system_disk_gb,
    bandwidth_mbps: instance.bandwidth_mbps,
    os_name: instance.os_name,
    expires_at: instance.expires_at,
    expires_at_overridden: instance.expires_at_overridden,
    source: instance.source,
    last_synced_at: instance.last_synced_at,
  };
}
