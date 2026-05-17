"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Check,
  Copy,
  Cpu,
  Edit2,
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

import type { FirewallRule, SshKey, VpsInstance, VpsStatus } from "./data";
import { VPS_FIREWALL_RULES, VPS_SSH_KEYS } from "./data";

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

/* -------------------------------------------------------------------------- */
/*  Root                                                                       */
/* -------------------------------------------------------------------------- */

export function VpsView({ instance }: { instance: VpsInstance }) {
  const [tab, setTab] = useState<VpsTab>("overview");

  return (
    <div className="flex h-full flex-col">
      <VpsHeader instance={instance} tab={tab} onTabChange={setTab} />
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
}: {
  instance: VpsInstance;
  tab: VpsTab;
  onTabChange: (t: VpsTab) => void;
}) {
  const isStopped = instance.status === "stopped";

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
              <StatusBadge status={instance.status} />
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
              {instance.uptime !== "—" && (
                <>
                  <span className="text-white/20">·</span>
                  <span>up {instance.uptime}</span>
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
              <Btn icon={Play} label="Start" primary />
            ) : (
              <Btn icon={Square} label="Stop" />
            )}
            <Btn icon={RotateCw} label="Reboot" disabled={isStopped} />
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
  const transferPct =
    instance.transferTotalGb && instance.transferTotalGb > 0
      ? Math.min(100, ((instance.transferUsedGb ?? 0) / instance.transferTotalGb) * 100)
      : 0;

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

            <FieldLabel>Uptime</FieldLabel>
            <span className="text-white/65">{instance.uptime}</span>

            {instance.expiresAt && (
              <>
                <FieldLabel>Expires</FieldLabel>
                <span className="text-white/65">{instance.expiresAt}</span>
              </>
            )}
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

          {instance.transferTotalGb != null && (
            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/40">Transfer this month</span>
                <span className="font-mono text-white/55">
                  {instance.transferUsedGb ?? 0} / {instance.transferTotalGb} GB
                </span>
              </div>
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[#3ecf8e]"
                  style={{ width: `${transferPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Resource meters */}
      <Card>
        <CardHeader title="Resource usage" note="Simulated · live metrics require API" />
        <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
          <ResourceMeter
            label="CPU"
            value={`${instance.cpu}%`}
            pct={instance.cpu}
            icon={Cpu}
            sub={`${instance.vcpu} vCPU`}
          />
          <ResourceMeter
            label="Memory"
            value={`${instance.memory}%`}
            pct={instance.memory}
            icon={MemoryStick}
            sub={`${instance.memoryGb} GB`}
          />
          <ResourceMeter
            label="Disk"
            value={`${instance.disk}%`}
            pct={instance.disk}
            icon={HardDrive}
            sub={`${instance.diskGb} GB`}
          />
          <ResourceMeter
            label="Network"
            value="48 MB/s"
            pct={32}
            icon={Activity}
            sub="in / out"
          />
        </div>
      </Card>

      {/* Row 3: Server login */}
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

function FirewallTab({ instance }: { instance: VpsInstance }) {
  const [rules, setRules] = useState<FirewallRule[]>(
    VPS_FIREWALL_RULES[instance.id] ?? [],
  );
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FwForm>(DEFAULT_FW_FORM);

  function openAdd() {
    setEditingId(null);
    setForm(DEFAULT_FW_FORM);
    setShowForm(true);
  }

  function openEdit(rule: FirewallRule) {
    setEditingId(rule.id);
    setForm({
      protocol: rule.protocol,
      port: rule.port,
      cidrBlock: rule.cidrBlock,
      action: rule.action,
      description: rule.description,
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(DEFAULT_FW_FORM);
  }

  function handleSubmit() {
    if (!form.port.trim() || !form.cidrBlock.trim()) return;
    if (editingId) {
      setRules((prev) => prev.map((r) => (r.id === editingId ? { ...form, id: editingId } : r)));
    } else {
      setRules((prev) => [...prev, { ...form, id: `fr${Date.now()}` }]);
    }
    cancelForm();
  }

  function deleteRule(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) cancelForm();
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

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-4">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-medium text-white/55">
              {editingId ? "Edit rule" : "New firewall rule"}
            </span>
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
              {editingId ? "Update" : "Add rule"}
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
        {rules.length === 0 ? (
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
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
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
                          onClick={() => openEdit(rule)}
                          className="rounded p-1.5 text-white/25 transition-colors hover:bg-white/[0.04] hover:text-white/60"
                          aria-label="Edit rule"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="rounded p-1.5 text-white/25 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

function SshTab({ instance }: { instance: VpsInstance }) {
  const [keys, setKeys] = useState<SshKey[]>(VPS_SSH_KEYS);
  const [showImport, setShowImport] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const boundCount = keys.filter((k) => k.boundInstances.includes(instance.id)).length;

  function closeImport() {
    setShowImport(false);
    setKeyName("");
    setPublicKey("");
  }

  function handleImport() {
    if (!keyName.trim() || !publicKey.trim()) return;
    setKeys((prev) => [
      ...prev,
      {
        id: `k${Date.now()}`,
        name: keyName.trim(),
        publicKey: publicKey.trim(),
        createdAt: new Date().toISOString().split("T")[0],
        boundInstances: [],
      },
    ]);
    closeImport();
  }

  function toggleBind(keyId: string) {
    setKeys((prev) =>
      prev.map((k) => {
        if (k.id !== keyId) return k;
        const already = k.boundInstances.includes(instance.id);
        return {
          ...k,
          boundInstances: already
            ? k.boundInstances.filter((id) => id !== instance.id)
            : [...k.boundInstances, instance.id],
        };
      }),
    );
  }

  function deleteKey(keyId: string) {
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
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
              className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-3 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
            >
              Import key
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
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/[0.06] py-14">
          <Key className="h-8 w-8 text-white/10" />
          <p className="text-[13px] text-white/30">No SSH keys in your account</p>
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => {
            const isBound = key.boundInstances.includes(instance.id);
            return (
              <div
                key={key.id}
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
                    <span className="text-[14px] font-medium text-white">{key.name}</span>
                    {isBound && (
                      <span className="rounded-full border border-[#3ecf8e]/20 bg-[#3ecf8e]/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[#3ecf8e]">
                        bound
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="max-w-[260px] truncate font-mono text-[11px] text-white/25">
                      {key.publicKey.slice(0, 52)}…
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(key.publicKey, key.id)}
                      className="text-white/25 transition-colors hover:text-white/55"
                      aria-label="Copy public key"
                    >
                      {copied === key.id ? (
                        <Check className="h-3 w-3 text-[#3ecf8e]" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-white/20">Added {key.createdAt}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleBind(key.id)}
                    className={`inline-flex h-7 items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors ${
                      isBound
                        ? "border-white/[0.08] text-white/45 hover:border-red-500/30 hover:text-red-400"
                        : "border-white/[0.08] text-white/45 hover:border-[#3ecf8e]/30 hover:text-[#3ecf8e]"
                    }`}
                  >
                    {isBound ? "Unbind" : "Bind"}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteKey(key.id)}
                    className="rounded p-1.5 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
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

function StatusBadge({ status }: { status: VpsStatus }) {
  const cls =
    status === "running"
      ? "border-[#3ecf8e]/20 bg-[#3ecf8e]/10 text-[#3ecf8e]"
      : status === "rebooting"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
        : "border-white/[0.08] bg-white/[0.04] text-white/40";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ${cls}`}>
      {status}
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
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base =
    "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const style = primary
    ? "bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e]"
    : danger
      ? "border border-red-500/20 bg-red-500/[0.05] text-red-400 hover:bg-red-500/10"
      : "border border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/[0.14] hover:bg-white/[0.05] hover:text-white/80";
  return (
    <button type="button" disabled={disabled} className={`${base} ${style}`}>
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

function ResourceMeter({
  label,
  value,
  pct,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  pct: number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
}) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-[#1c1c1c] p-3">
      <div className="mb-1.5 flex items-center justify-between text-white/30">
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em]">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span className="font-mono text-[10px]">{sub}</span>
      </div>
      <div className="text-[20px] font-medium leading-none text-white">{value}</div>
      <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-[#3ecf8e]"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
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
