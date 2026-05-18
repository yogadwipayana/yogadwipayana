"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Check,
  Copy,
  Cpu,
  Globe,
  HardDrive,
  Key,
  Lock,
  MemoryStick,
  Play,
  Plus,
  RotateCw,
  Server,
  Shield,
  Square,
  Trash2,
  X,
} from "lucide-react";

import type { FirewallRule, VpsInstance, VpsStatus } from "./data";
import { vpsApi, type VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";
import { normalizeStatus } from "@/lib/client/vps-mappers";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type VpsTab = "overview" | "firewall" | "ssh";

type FwForm = {
  protocol: "TCP" | "UDP" | "ICMP" | "ALL";
  port: string;
  cidrBlock: string;
  action: "ACCEPT" | "DROP";
  description: string;
};

const DEFAULT_FW_FORM: FwForm = {
  protocol: "TCP",
  port: "",
  cidrBlock: "0.0.0.0/0",
  action: "ACCEPT",
  description: "",
};

type LifecycleAction = "start" | "stop" | "reboot";

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function VpsView({ instance: initialInstance }: { instance: VpsInstance }) {
  const [tab, setTab] = useState<VpsTab>("overview");
  const [instance, setInstance] = useState<VpsInstance>(initialInstance);

  // When the parent shell switches selected instance, reset local state.
  useEffect(() => {
    setInstance(initialInstance);
  }, [initialInstance]);

  return (
    <div className="flex h-full flex-col">
      <VpsHeader
        instance={instance}
        tab={tab}
        onTabChange={setTab}
        onInstanceUpdate={setInstance}
      />
      <div className="flex-1 overflow-y-auto">
        {tab === "overview" && <OverviewTab instance={instance} onGoSsh={() => setTab("ssh")} />}
        {tab === "firewall" && <FirewallTab instance={instance} />}
        {tab === "ssh" && <SshTab instance={instance} />}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                     */
/* -------------------------------------------------------------------------- */

function VpsHeader({
  instance,
  tab,
  onTabChange,
  onInstanceUpdate,
}: {
  instance: VpsInstance;
  tab: VpsTab;
  onTabChange: (t: VpsTab) => void;
  onInstanceUpdate: (next: VpsInstance) => void;
}) {
  const isStopped = instance.status === "stopped";
  const isTransitional = instance.status === "rebooting";

  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (target: "RUNNING" | "STOPPED") => {
      stopPolling();
      const startedAt = Date.now();
      const TIMEOUT_MS = 120_000;
      pollRef.current = setInterval(async () => {
        try {
          const data = await vpsApi.listInstances();
          const fresh = data.instances.find((i) => i.id === instance.id);
          if (fresh) {
            const ps = (fresh.provider_status ?? fresh.status ?? "").toUpperCase();
            onInstanceUpdate(applyApiPatch(instance, fresh));
            if (ps === target) {
              stopPolling();
              setPendingAction(null);
            }
          }
        } catch {
          // Network blip — keep polling until timeout.
        }
        if (Date.now() - startedAt > TIMEOUT_MS) {
          stopPolling();
          setPendingAction(null);
          setActionError("Action timed out — refresh to see latest status.");
        }
      }, 2000);
    },
    [instance, onInstanceUpdate, stopPolling],
  );

  async function runAction(action: LifecycleAction) {
    setActionError(null);
    setPendingAction(action);
    try {
      await vpsApi.performAction(instance.id, action);
      const target: "RUNNING" | "STOPPED" = action === "stop" ? "STOPPED" : "RUNNING";
      startPolling(target);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setActionError(message);
      setPendingAction(null);
    }
  }

  function onClickAction(action: LifecycleAction) {
    if (action === "start") {
      void runAction("start");
      return;
    }
    setConfirmAction(action);
  }

  return (
    <div className="shrink-0 border-b border-white/[0.06] bg-[#171717]">
      <div className="px-6 pt-6 pb-0 sm:px-8">
        {/* Name + status + actions */}
        <div className="flex flex-wrap items-start justify-between gap-4 pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusDot status={instance.status} />
              <h2 className="font-mono text-[20px] font-medium tracking-[-0.01em] text-white">
                {instance.name}
              </h2>
              <StatusBadge status={instance.status} providerStatus={instance.providerStatus} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/45">
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {instance.region}
                {instance.zone ? ` · ${instance.zone}` : ""}
              </span>
              {instance.ipv4 !== "—" && (
                <>
                  <span className="text-white/20">·</span>
                  <IpDisplay ip={instance.ipv4} />
                </>
              )}
              {instance.osName && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="font-mono">{instance.osName}</span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {isStopped ? (
              <Btn
                icon={Play}
                label={pendingAction === "start" ? "Starting…" : "Start"}
                primary
                onClick={() => onClickAction("start")}
                disabled={pendingAction !== null || isTransitional}
              />
            ) : (
              <Btn
                icon={Square}
                label={pendingAction === "stop" ? "Stopping…" : "Stop"}
                onClick={() => onClickAction("stop")}
                disabled={pendingAction !== null || isTransitional}
              />
            )}
            <Btn
              icon={RotateCw}
              label={pendingAction === "reboot" ? "Rebooting…" : "Reboot"}
              onClick={() => onClickAction("reboot")}
              disabled={isStopped || pendingAction !== null || isTransitional}
            />
            <BtnLink
              href={`/dashboard/vps/reset?id=${instance.id}`}
              icon={Lock}
              label="Reset password"
            />
            <BtnLink
              href={`/dashboard/vps/reinstall?id=${instance.id}`}
              icon={Server}
              label="Reinstall"
              danger
            />
          </div>
        </div>

        {actionError && (
          <div className="mb-3 rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
            {actionError}
          </div>
        )}

        {/* Tab nav */}
        <div className="flex">
          {(["overview", "firewall", "ssh"] as VpsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`mr-6 whitespace-nowrap border-b-2 py-2.5 text-[13px] font-medium transition-colors ${
                tab === t
                  ? "border-[#3ecf8e] text-white"
                  : "border-transparent text-white/40 hover:text-white/65"
              }`}
            >
              {t === "ssh" ? "SSH Keys" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {confirmAction && (
        <ConfirmModal
          action={confirmAction}
          instanceName={instance.name}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            const a = confirmAction;
            setConfirmAction(null);
            void runAction(a);
          }}
        />
      )}
    </div>
  );
}

function applyApiPatch(prev: VpsInstance, api: ApiVpsInstance): VpsInstance {
  const ps = api.provider_status ?? api.status;
  return {
    ...prev,
    name: api.name,
    region: api.region,
    zone: api.zone ?? undefined,
    ipv4: api.ip_public ?? "—",
    status: normalizeStatus(ps),
    providerStatus: ps,
    vcpu: api.cpu ?? prev.vcpu,
    memoryGb: api.memory_gb ?? prev.memoryGb,
    diskGb: api.system_disk_gb ?? prev.diskGb,
    bandwidthMbps: api.bandwidth_mbps ?? prev.bandwidthMbps,
    osName: api.os_name ?? prev.osName,
  };
}

function ConfirmModal({
  action,
  instanceName,
  onCancel,
  onConfirm,
}: {
  action: LifecycleAction;
  instanceName: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const verb = action === "stop" ? "stop" : "reboot";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#171717] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-white">Confirm {verb}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/35 hover:text-white/60"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-6 text-[13px] leading-relaxed text-white/55">
          You are about to {verb} <strong className="text-white">{instanceName}</strong>. Active
          sessions will be interrupted.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md border border-white/[0.08] py-2 text-[13px] text-white/55 hover:bg-white/[0.04] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/15 transition-colors"
          >
            Confirm {verb}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Overview tab                                                               */
/* -------------------------------------------------------------------------- */

function OverviewTab({
  instance,
  onGoSsh,
}: {
  instance: VpsInstance;
  onGoSsh: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-6 sm:p-8">
      {/* Row 1: Details + Specs */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
        {/* Details */}
        <Card>
          <CardHeader title="Instance details" />
          <div className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-3.5 p-4 text-[13px]">
            <FieldLabel>Status</FieldLabel>
            <div className="flex items-center gap-1.5">
              <StatusDot status={instance.status} />
              <span className="font-medium text-white">{statusLabel(instance.status)}</span>
              {instance.providerStatus &&
                instance.providerStatus.toUpperCase() !==
                  instance.status.toUpperCase() && (
                  <span className="font-mono text-[11px] text-white/35">
                    · {instance.providerStatus}
                  </span>
                )}
            </div>

            <FieldLabel>Region</FieldLabel>
            <span className="text-white/80">
              {instance.region}
              {instance.zone ? ` · Zone ${instance.zone}` : ""}
            </span>

            {instance.ipv4 !== "—" && (
              <>
                <FieldLabel>IPv4</FieldLabel>
                <IpDisplay ip={instance.ipv4} />
              </>
            )}

            <FieldLabel>OS</FieldLabel>
            <span className="font-mono text-white/65">{instance.osName ?? "—"}</span>

            {instance.expiresAt && (
              <>
                <FieldLabel>Expires</FieldLabel>
                <span className="text-white/65">{instance.expiresAt}</span>
              </>
            )}

            <FieldLabel>Instance ID</FieldLabel>
            <span className="font-mono text-[11px] text-white/40">{instance.externalInstanceId}</span>
          </div>
        </Card>

        {/* Specs */}
        <div className="rounded-lg border border-[#3ecf8e]/[0.12] bg-[#3ecf8e]/[0.04] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">
              Specifications
            </span>
            <Server className="h-3.5 w-3.5 text-white/20" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <SpecCell icon={Cpu} label="CPU" value={`${instance.vcpu} vCPU`} />
            <SpecCell icon={MemoryStick} label="Memory" value={`${instance.memoryGb} GB`} />
            <SpecCell icon={HardDrive} label="Storage" value={`${instance.diskGb} GB SSD`} />
            <SpecCell
              icon={Activity}
              label="Bandwidth"
              value={instance.bandwidthMbps ? `${instance.bandwidthMbps} Mbps` : "—"}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Server login */}
      <Card>
        <CardHeader title="Server login" />
        <div className="space-y-4 p-4">
          {instance.ipv4 !== "—" ? (
            <div className="overflow-hidden rounded-md border border-white/[0.06] bg-[#0f0f0f]">
              <div className="border-b border-white/[0.04] px-4 py-2">
                <span className="text-[10px] uppercase tracking-[0.1em] text-white/25">
                  SSH command
                </span>
              </div>
              <pre className="px-4 py-3 font-mono text-[12px] leading-relaxed text-white/80">
                <code>$ ssh root@{instance.ipv4}</code>
              </pre>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-3 text-[12px] text-white/35">
              Instance is stopped — no public IP available
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <SmallBtnLink
              href={`/dashboard/vps/reset?id=${instance.id}`}
              icon={Lock}
              label="Reset password"
            />
            <SmallBtn icon={Key} label="Manage SSH keys" onClick={onGoSsh} />
          </div>

          <p className="text-[12px] leading-relaxed text-white/30">
            Reset the root password or bind an SSH key before logging in for the first time.
          </p>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Firewall tab                                                               */
/* -------------------------------------------------------------------------- */

type TencentFirewallRule = {
  Protocol: string;
  Port: string;
  CidrBlock: string;
  Action: string;
  FirewallRuleDescription?: string;
};

function ruleKey(r: FirewallRule): string {
  return `${r.protocol}|${r.port}|${r.cidrBlock}|${r.action}|${r.description ?? ""}`;
}

function fromTencent(r: TencentFirewallRule, idx: number): FirewallRule {
  return {
    id: `fr-${idx}-${r.Protocol}-${r.Port}-${r.CidrBlock}`,
    protocol: (r.Protocol?.toUpperCase() as FirewallRule["protocol"]) ?? "TCP",
    port: r.Port ?? "",
    cidrBlock: r.CidrBlock ?? "",
    action: (r.Action?.toUpperCase() as FirewallRule["action"]) ?? "ACCEPT",
    description: r.FirewallRuleDescription ?? "",
  };
}

function FirewallTab({ instance }: { instance: VpsInstance }) {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FwForm>(DEFAULT_FW_FORM);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await vpsApi.listFirewall(instance.id)) as {
        rules?: TencentFirewallRule[];
      };
      const list = (data.rules ?? []).map((r, i) => fromTencent(r, i));
      setRules(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load firewall rules");
    } finally {
      setLoading(false);
    }
  }, [instance.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function openAdd() {
    setForm(DEFAULT_FW_FORM);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setForm(DEFAULT_FW_FORM);
  }

  async function handleSubmit() {
    if (!form.port.trim() || !form.cidrBlock.trim()) return;
    setError(null);
    try {
      await vpsApi.addFirewallRule(instance.id, {
        protocol: form.protocol,
        port: form.port,
        cidrBlock: form.cidrBlock,
        action: form.action,
        description: form.description || undefined,
      });
      cancelForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add rule");
    }
  }

  async function deleteRule(rule: FirewallRule) {
    setError(null);
    setBusyKey(ruleKey(rule));
    try {
      await vpsApi.removeFirewallRuleByDef(instance.id, {
        protocol: rule.protocol,
        port: rule.port,
        cidrBlock: rule.cidrBlock,
        action: rule.action,
        description: rule.description || undefined,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete rule");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6 sm:p-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium text-white">Firewall rules</h3>
          <p className="mt-0.5 text-[12px] text-white/40">
            Inbound traffic control for{" "}
            <span className="font-mono">{instance.name}</span> ·{" "}
            {rules.length} rule{rules.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/55">New firewall rule</span>
            <button
              type="button"
              onClick={cancelForm}
              className="text-white/30 transition-colors hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FieldGroup label="Protocol">
              <FormSelect
                value={form.protocol}
                onChange={(v) => setForm((f) => ({ ...f, protocol: v as FwForm["protocol"] }))}
                options={["TCP", "UDP", "ICMP", "ALL"]}
              />
            </FieldGroup>
            <FieldGroup label="Port">
              <FormInput
                value={form.port}
                onChange={(v) => setForm((f) => ({ ...f, port: v }))}
                placeholder="22 or 80-443"
              />
            </FieldGroup>
            <FieldGroup label="Source CIDR">
              <FormInput
                value={form.cidrBlock}
                onChange={(v) => setForm((f) => ({ ...f, cidrBlock: v }))}
                placeholder="0.0.0.0/0"
              />
            </FieldGroup>
            <FieldGroup label="Action">
              <FormSelect
                value={form.action}
                onChange={(v) => setForm((f) => ({ ...f, action: v as FwForm["action"] }))}
                options={["ACCEPT", "DROP"]}
              />
            </FieldGroup>
          </div>

          <div className="mb-4">
            <FieldGroup label="Description">
              <FormInput
                value={form.description}
                onChange={(v) => setForm((f) => ({ ...f, description: v }))}
                placeholder="Optional"
              />
            </FieldGroup>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Add rule
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-3 text-[13px] text-white/50 transition-colors hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rules table */}
      <div className="overflow-hidden rounded-lg border border-white/[0.08]">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
            <div className="h-4 w-48 animate-pulse rounded bg-white/[0.04]" />
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <Shield className="h-8 w-8 text-white/10" />
            <p className="text-[13px] text-white/30">No rules — all inbound traffic is blocked</p>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-white/[0.08] px-3 text-[12px] text-white/40 transition-colors hover:bg-white/[0.04] hover:text-white/60"
            >
              <Plus className="h-3 w-3" />
              Add first rule
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#171717]">
                  {["Protocol", "Port", "Source", "Action", "Description", ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-[0.1em] text-white/25"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const k = ruleKey(rule);
                  const busy = busyKey === k;
                  return (
                    <tr
                      key={k}
                      className="border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2.5">
                        <span className="rounded-sm bg-white/[0.06] px-1.5 py-0.5 font-mono text-[11px] text-white/55">
                          {rule.protocol}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-white/75">{rule.port}</td>
                      <td className="px-4 py-2.5 font-mono text-white/50">{rule.cidrBlock}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${
                            rule.action === "ACCEPT"
                              ? "bg-[#3ecf8e]/10 text-[#3ecf8e]"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {rule.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-white/35">{rule.description || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => deleteRule(rule)}
                            disabled={busy}
                            className="rounded p-1.5 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                            aria-label="Delete rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SSH Keys tab                                                               */
/* -------------------------------------------------------------------------- */

type TencentKeyPair = {
  KeyId: string;
  KeyName?: string;
  PublicKey?: string;
  AssociatedInstanceIds?: string[];
  CreatedTime?: string;
};

function SshTab({ instance }: { instance: VpsInstance }) {
  const [keys, setKeys] = useState<TencentKeyPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKeyId, setBusyKeyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await vpsApi.listSshKeys()) as { keys?: TencentKeyPair[] };
      setKeys(data.keys ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SSH keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const boundCount = keys.filter((k) =>
    k.AssociatedInstanceIds?.includes(instance.externalInstanceId),
  ).length;

  function closeImport() {
    setShowImport(false);
    setKeyName("");
    setPublicKey("");
  }

  async function handleImport() {
    if (!keyName.trim() || !publicKey.trim()) return;
    setError(null);
    setImporting(true);
    try {
      await vpsApi.importSshKey(keyName.trim(), publicKey.trim());
      closeImport();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import SSH key");
    } finally {
      setImporting(false);
    }
  }

  async function toggleBind(key: TencentKeyPair) {
    if (!key.KeyId) return;
    setError(null);
    setBusyKeyId(key.KeyId);
    const isBound = key.AssociatedInstanceIds?.includes(instance.externalInstanceId);
    try {
      if (isBound) {
        await vpsApi.unbindSshKey(instance.id, key.KeyId);
      } else {
        await vpsApi.bindSshKey(instance.id, key.KeyId);
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update binding");
    } finally {
      setBusyKeyId(null);
    }
  }

  async function deleteKey(keyId: string) {
    setError(null);
    setBusyKeyId(keyId);
    try {
      await vpsApi.deleteSshKey(keyId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete SSH key");
    } finally {
      setBusyKeyId(null);
    }
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="flex flex-col gap-5 p-6 sm:p-8">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-medium text-white">SSH Keys</h3>
          <p className="mt-0.5 text-[12px] text-white/40">
            {boundCount} key{boundCount !== 1 ? "s" : ""} bound to{" "}
            <span className="font-mono">{instance.name}</span>
          </p>
        </div>
        {!showImport && (
          <button
            type="button"
            onClick={() => setShowImport(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
          >
            <Plus className="h-3.5 w-3.5" />
            Import key
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
          {error}
        </div>
      )}

      {/* Import form */}
      {showImport && (
        <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/55">Import public key</span>
            <button
              type="button"
              onClick={closeImport}
              className="text-white/30 transition-colors hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <FieldGroup label="Key Name">
            <FormInput
              value={keyName}
              onChange={setKeyName}
              placeholder="e.g. macbook-personal"
            />
          </FieldGroup>

          <FieldGroup label="Public Key">
            <textarea
              value={publicKey}
              onChange={(e) => setPublicKey(e.target.value)}
              rows={3}
              placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
              className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
            />
          </FieldGroup>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
            >
              {importing ? "Importing…" : "Import key"}
            </button>
            <button
              type="button"
              onClick={closeImport}
              className="inline-flex h-8 items-center rounded-md border border-white/[0.08] px-3 text-[13px] text-white/50 transition-colors hover:bg-white/[0.04]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-white/[0.05] bg-white/[0.02]"
            />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/[0.06] py-14">
          <Key className="h-8 w-8 text-white/10" />
          <p className="text-[13px] text-white/30">No SSH keys in your account</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => {
            if (!key.KeyId) return null;
            const isBound = key.AssociatedInstanceIds?.includes(
              instance.externalInstanceId,
            );
            const busy = busyKeyId === key.KeyId;
            const pk = key.PublicKey ?? "";
            return (
              <div
                key={key.KeyId}
                className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${
                  isBound
                    ? "border-[#3ecf8e]/[0.14] bg-[#3ecf8e]/[0.03]"
                    : "border-white/[0.06] bg-[#171717]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Key
                      className={`h-3.5 w-3.5 shrink-0 ${isBound ? "text-[#3ecf8e]" : "text-white/30"}`}
                    />
                    <span className="text-[14px] font-medium text-white">
                      {key.KeyName ?? key.KeyId}
                    </span>
                    {isBound && (
                      <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                        bound
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="max-w-[260px] truncate font-mono text-[11px] text-white/25">
                      {pk.slice(0, 52)}{pk.length > 52 ? "…" : ""}
                    </span>
                    {pk && (
                      <button
                        type="button"
                        onClick={() => copyText(pk, key.KeyId!)}
                        className="text-white/25 transition-colors hover:text-white/55"
                        aria-label="Copy public key"
                      >
                        {copied === key.KeyId ? (
                          <Check className="h-3 w-3 text-[#3ecf8e]" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                  {key.CreatedTime && (
                    <p className="mt-1 text-[11px] text-white/20">
                      Added {key.CreatedTime.slice(0, 10)}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleBind(key)}
                    disabled={busy}
                    className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors disabled:opacity-50 ${
                      isBound
                        ? "border-white/[0.08] text-white/45 hover:border-red-500/30 hover:text-red-400"
                        : "border-white/[0.08] text-white/45 hover:border-[#3ecf8e]/30 hover:text-[#3ecf8e]"
                    }`}
                  >
                    {busy ? "…" : isBound ? "Unbind" : "Bind"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteKey(key.KeyId!)}
                    disabled={busy}
                    className="rounded p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    aria-label="Delete key"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared UI primitives                                                       */
/* -------------------------------------------------------------------------- */

function StatusDot({ status }: { status: VpsStatus }) {
  const cls =
    status === "running"
      ? "bg-[#3ecf8e] shadow-[0_0_8px_#3ecf8e]"
      : status === "rebooting"
        ? "bg-amber-400"
        : "bg-white/25";
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function StatusBadge({ status, providerStatus }: { status: VpsStatus; providerStatus?: string }) {
  const cls =
    status === "running"
      ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
      : status === "rebooting"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : "border-white/[0.08] bg-white/[0.04] text-white/40";
  const label = providerStatus && providerStatus.length > 0 ? providerStatus : status;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${cls}`}>
      {label}
    </span>
  );
}

function IpDisplay({ ip }: { ip: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(ip).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono">
      <span>{ip}</span>
      <button
        type="button"
        onClick={copy}
        className="text-white/25 transition-colors hover:text-white/60"
        aria-label="Copy IP"
      >
        {copied ? (
          <Check className="h-3 w-3 text-[#3ecf8e]" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </span>
  );
}

function Btn({
  icon: Icon,
  label,
  primary,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const base =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const style = primary
    ? "bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e]"
    : danger
      ? "border border-red-500/20 bg-red-500/[0.05] text-red-400 hover:bg-red-500/10"
      : "border border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/80";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SmallBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 text-[12px] text-white/50 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/70"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function BtnLink({
  href,
  icon: Icon,
  label,
  danger,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
}) {
  const style = danger
    ? "border border-red-500/20 bg-red-500/[0.05] text-red-400 hover:bg-red-500/10"
    : "border border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/80";
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors ${style}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function SmallBtnLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 text-[12px] text-white/50 transition-colors hover:border-white/[0.14] hover:bg-white/[0.04] hover:text-white/70"
    >
      <Icon className="h-3 w-3" />
      {label}
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#171717]">
      {children}
    </div>
  );
}

function CardHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/35">
        {title}
      </span>
      {note && <span className="text-[10px] text-white/20">{note}</span>}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-medium text-white/40">{children}</span>;
}

function SpecCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="mb-1 flex items-center gap-1 text-white/30">
        <Icon className="h-3 w-3" />
        <span className="text-[9px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <div className="text-[13px] font-medium text-white">{value}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-[0.1em] text-white/35">
        {label}
      </label>
      {children}
    </div>
  );
}

function FormInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
    />
  );
}

function FormSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1.5 text-[13px] text-white focus:border-[#3ecf8e]/40 focus:outline-none"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function statusLabel(status: VpsStatus) {
  const map: Record<VpsStatus, string> = {
    running: "Running",
    stopped: "Stopped",
    rebooting: "Rebooting",
  };
  return map[status] ?? status;
}
