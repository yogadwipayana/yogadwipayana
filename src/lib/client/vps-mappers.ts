import type { VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";
import type { VpsInstance as UiVpsInstance, VpsStatus } from "@/app/dashboard/data";

export function normalizeStatus(providerStatus: string | null | undefined): VpsStatus {
  const s = String(providerStatus ?? "").toUpperCase();
  if (s === "RUNNING") return "running";
  if (s === "STOPPED" || s === "SHUTDOWN") return "stopped";
  if (
    s === "STARTING" ||
    s === "STOPPING" ||
    s === "REBOOTING" ||
    s === "PENDING" ||
    s === "RESETTING" ||
    s === "OPERATING"
  ) {
    return "rebooting";
  }
  return "stopped";
}

function formatExpiry(iso: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function toUiInstance(api: ApiVpsInstance): UiVpsInstance {
  return {
    id: api.id,
    externalInstanceId: api.external_instance_id,
    name: api.name,
    region: api.region,
    zone: api.zone ?? undefined,
    ipv4: api.ip_public ?? "—",
    status: normalizeStatus(api.provider_status ?? api.status),
    providerStatus: api.provider_status ?? api.status,
    vcpu: api.cpu ?? 0,
    memoryGb: api.memory_gb ?? 0,
    diskGb: api.system_disk_gb ?? 0,
    bandwidthMbps: api.bandwidth_mbps ?? undefined,
    osName: api.os_name ?? undefined,
    expiresAt: formatExpiry(api.expires_at),
  };
}
