/**
 * Thin client-side wrapper around the /api/vps/* routes.
 *
 * Mirrors the patterns from the origin dashboard-api: throws on non-2xx,
 * surfaces the server-provided error message, and redirects to /sign-in on
 * 401 so users don't end up staring at a console error.
 */

function redirectToSignIn() {
  if (typeof window === "undefined") return;
  const callbackUrl = `${window.location.pathname}${window.location.search}`;
  const url = new URL("/sign-in", window.location.origin);
  url.searchParams.set("next", callbackUrl);
  window.location.href = url.toString();
}

type ApiErrorBody = { error?: { code?: string; message?: string; details?: unknown } };

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.message ?? `Request failed: ${res.status}`;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) redirectToSignIn();
    throw new Error(await readError(res));
  }
  return (await res.json()) as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "DELETE" | "PUT",
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401) redirectToSignIn();
    throw new Error(await readError(res));
  }
  return (await res.json()) as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed shorthands
// ─────────────────────────────────────────────────────────────────────────────

export interface VpsInstance {
  id: string;
  external_instance_id: string;
  name: string;
  region: string;
  zone: string | null;
  status: string;
  provider_status: string;
  ip_public: string | null;
  ip_private: string | null;
  cpu: number | null;
  memory_gb: number | null;
  system_disk_gb: number | null;
  bandwidth_mbps: number | null;
  os_name: string | null;
  expires_at: string | null;
  source: "order" | "byok_import";
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export const vpsApi = {
  listInstances: (refresh = false) =>
    apiGet<{ instances: VpsInstance[] }>(`/api/vps/instances${refresh ? "?refresh=true" : ""}`),
  getInstanceDetail: (id: string, refresh = false) =>
    apiGet(`/api/vps/instances/${id}/detail${refresh ? "?refresh=true" : ""}`),
  removeInstance: (id: string) =>
    apiSend<{ removed: boolean; id: string }>(`/api/vps/instances/${id}`, "DELETE"),
  performAction: (id: string, action: "start" | "stop" | "reboot") =>
    apiSend(`/api/vps/instances/${id}/actions/${action}`, "POST"),
  resetPassword: (id: string, body: { username?: string; password: string }) =>
    apiSend(`/api/vps/instances/${id}/reset-password`, "POST", body),
  reinstall: (id: string, body: { blueprintId: string; password?: string; keyId?: string }) =>
    apiSend(`/api/vps/instances/${id}/reinstall`, "POST", body),
  listFirewall: (id: string) => apiGet(`/api/vps/instances/${id}/firewall`),
  addFirewallRule: (
    id: string,
    body: {
      protocol: "TCP" | "UDP" | "ICMP" | "ALL";
      port: string;
      cidrBlock: string;
      action: "ACCEPT" | "DROP";
      description?: string;
    },
  ) => apiSend(`/api/vps/instances/${id}/firewall`, "POST", body),
  removeFirewallRule: (id: string, ruleId: string) =>
    apiSend(`/api/vps/instances/${id}/firewall/${ruleId}`, "DELETE"),
  removeFirewallRuleByDef: (
    id: string,
    rule: {
      protocol: "TCP" | "UDP" | "ICMP" | "ALL";
      port: string;
      cidrBlock: string;
      action: "ACCEPT" | "DROP";
      description?: string;
    },
  ) => apiSend(`/api/vps/instances/${id}/firewall`, "DELETE", { rule }),
  bindSshKey: (id: string, keyId: string) =>
    apiSend(`/api/vps/instances/${id}/ssh-keys/bind`, "POST", { keyId }),
  unbindSshKey: (id: string, keyId: string) =>
    apiSend(`/api/vps/instances/${id}/ssh-keys/${keyId}`, "DELETE"),

  getCatalog: () => apiGet(`/api/vps/catalog`),

  byokConnect: (body: { secretId: string; secretKey: string; region: string }) =>
    apiSend(`/api/vps/byok/connect`, "POST", body),
  byokImport: (body: {
    externalInstanceId: string;
    secretId: string;
    secretKey: string;
    region: string;
  }) => apiSend(`/api/vps/byok/import`, "POST", body),

  listSshKeys: () => apiGet(`/api/vps/ssh-keys`),
  generateSshKey: (keyName: string) =>
    apiSend(`/api/vps/ssh-keys/generate`, "POST", { keyName }),
  importSshKey: (keyName: string, publicKey: string) =>
    apiSend(`/api/vps/ssh-keys/import`, "POST", { keyName, publicKey }),
  deleteSshKey: (keyId: string) => apiSend(`/api/vps/ssh-keys/${keyId}`, "DELETE"),
  editSshKey: (keyId: string, body: { keyName: string; publicKey: string }) =>
    apiSend(`/api/vps/ssh-keys/${keyId}`, "PUT", body),
};
