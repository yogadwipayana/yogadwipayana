"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  RotateCw,
  X,
} from "lucide-react";

import { vpsApi } from "@/lib/client/vps-api";
import type { VpsInstance } from "@/lib/client/vps-api";
import { validateVpsPassword } from "@/lib/client/vps-password";

type Blueprint = {
  BlueprintId: string;
  BlueprintName?: string;
  OsName?: string;
  Platform?: string;
  PlatformType?: string;
};

/* -------------------------------------------------------------------------- */
/*  OS families                                                                */
/* -------------------------------------------------------------------------- */

type OsFamily = {
  key: string;
  label: string;
  icon: string;
  versions: string[];
  description: string;
};

const OS_FAMILIES: OsFamily[] = [
  {
    key: "ubuntu",
    label: "Ubuntu",
    icon: "/images/Ubuntu.svg",
    versions: ["Ubuntu 24.04 LTS", "Ubuntu 22.04 LTS", "Ubuntu 20.04 LTS"],
    description:
      "Ubuntu LTS gives broad ecosystem compatibility, predictable long-term updates, and easy automation for common web and container workloads.",
  },
  {
    key: "debian",
    label: "Debian",
    icon: "/images/Debian.svg",
    versions: ["Debian 12", "Debian 11"],
    description:
      "Debian provides excellent stability, a conservative package policy, and reliable behavior for production services that prioritize consistency.",
  },
  {
    key: "centos",
    label: "CentOS Stream",
    icon: "/images/CentOSStream.svg",
    versions: ["CentOS Stream 9", "CentOS Stream 8"],
    description:
      "CentOS Stream tracks upcoming RHEL minor updates — a good fit when you want newer packages with enterprise-like behavior.",
  },
  {
    key: "rocky",
    label: "Rocky Linux",
    icon: "/images/Rockylinux.svg",
    versions: ["Rocky Linux 9", "Rocky Linux 8"],
    description:
      "Rocky Linux is enterprise-grade and RHEL-compatible, designed for stability and smooth migration from CentOS environments.",
  },
  {
    key: "opencloud",
    label: "OpenCloudOS",
    icon: "/images/opencloud.svg",
    versions: ["OpenCloudOS 9", "OpenCloudOS 8"],
    description:
      "OpenCloudOS is optimised for cloud-native workloads with stable performance, strong security hardening, and long-term enterprise support.",
  },
];

/* -------------------------------------------------------------------------- */
/*  Blueprint matcher                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Map an OS version label like "Ubuntu 22.04 LTS" onto a Tencent BlueprintId
 * by fuzzy-matching against the blueprint's name and OS name fields. Returns
 * null when no candidate matches — caller should disable the option.
 */
function matchBlueprintId(blueprints: Blueprint[], versionLabel: string): string | null {
  if (!blueprints.length || !versionLabel) return null;
  const target = versionLabel.toLowerCase().replace(/\s+/g, " ").trim();

  // Tokens extracted from the label: words and version numbers.
  const tokens = target.split(/[^a-z0-9.]+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let best: { score: number; id: string } | null = null;
  for (const bp of blueprints) {
    if (!bp.BlueprintId) continue;
    const haystack = [bp.BlueprintName, bp.OsName, bp.Platform]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack) continue;
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += t.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { score, id: bp.BlueprintId };
    }
  }
  return best?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                              */
/* -------------------------------------------------------------------------- */

type VersionOption = { label: string; available: boolean };

function VersionDropdown({
  value,
  options,
  onChange,
  catalogLoading,
}: {
  value: string;
  options: VersionOption[];
  onChange: (v: string) => void;
  catalogLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.label === value)),
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => {
          for (let step = 1; step <= options.length; step++) {
            const next = (i + step) % options.length;
            if (options[next].available) return next;
          }
          return i;
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => {
          for (let step = 1; step <= options.length; step++) {
            const next = (i - step + options.length) % options.length;
            if (options[next].available) return next;
          }
          return i;
        });
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        const idx = options.findIndex((o) => o.available);
        if (idx >= 0) setActiveIndex(idx);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        for (let i = options.length - 1; i >= 0; i--) {
          if (options[i].available) {
            setActiveIndex(i);
            return;
          }
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const opt = options[activeIndex];
        if (opt && opt.available) {
          onChange(opt.label);
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, activeIndex, onChange]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.label === value);
    if (idx >= 0) setActiveIndex(idx);
  }, [open, value, options]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function handleTriggerKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-md border bg-[#1c1c1c] px-3 py-2 text-left transition-colors ${
          open
            ? "border-[#3ecf8e]/40"
            : "border-white/[0.08] hover:border-white/[0.14]"
        }`}
      >
        <Cpu className="h-3.5 w-3.5 shrink-0 text-white/35" />
        <span className="flex-1 truncate text-[13px] text-white">{value}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-white/35 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-auto rounded-md border border-white/[0.08] bg-[#171717] py-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] animate-in fade-in-0 zoom-in-95 duration-100"
        >
          {options.map((opt, idx) => {
            const selected = opt.label === value;
            const active = idx === activeIndex;
            const disabled = !opt.available && !catalogLoading;
            return (
              <button
                key={opt.label}
                type="button"
                role="option"
                aria-selected={selected}
                data-index={idx}
                disabled={disabled}
                onMouseEnter={() => !disabled && setActiveIndex(idx)}
                onClick={() => {
                  if (disabled) return;
                  onChange(opt.label);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-white/25"
                    : active
                      ? "bg-white/[0.05] text-white"
                      : "text-white/80"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${
                    selected ? "text-[#3ecf8e]" : "text-transparent"
                  }`}
                />
                <span className="flex-1 truncate">{opt.label}</span>
                {disabled && (
                  <span className="text-[11px] text-white/30">not available</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  step,
  title,
  children,
  tone = "default",
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const isDanger = tone === "danger";
  return (
    <div
      className={`overflow-hidden rounded-lg border bg-[#171717] ${
        isDanger
          ? "border-red-500/25 border-l-2 border-l-red-500/60"
          : "border-white/[0.08]"
      }`}
    >
      <div
        className={`border-b px-6 py-3.5 ${
          isDanger ? "border-red-500/15 bg-red-500/[0.04]" : "border-white/[0.05]"
        }`}
      >
        <h2 className="flex items-center gap-2.5 text-[14px] font-medium text-white">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
              isDanger
                ? "bg-red-500/15 text-red-400"
                : "bg-white/[0.08] text-white/60"
            }`}
          >
            {step}
          </span>
          {title}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const display = value && value.length > 0 ? value : "—";
  const empty = !value || value.length === 0;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">{label}</span>
      <span
        className={`text-[13px] ${empty ? "text-white/30" : "text-white/85"} ${
          mono ? "font-mono" : ""
        }`}
      >
        {display}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
  const tone =
    s === "running"
      ? "border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.08] text-[#3ecf8e]"
      : s === "stopped" || s === "shutoff"
        ? "border-white/[0.1] bg-white/[0.04] text-white/55"
        : s === "starting" || s === "rebooting" || s === "stopping"
          ? "border-amber-400/25 bg-amber-400/[0.08] text-amber-300"
          : "border-white/[0.1] bg-white/[0.04] text-white/55";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}
    >
      {status || "unknown"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main content                                                               */
/* -------------------------------------------------------------------------- */

function ReinstallContent() {
  const params = useSearchParams();
  const instanceId = params.get("id") ?? "";

  /* Catalog of available blueprints from Tencent */
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  /* Target instance details */
  const [instance, setInstance] = useState<VpsInstance | null>(null);
  const [instanceLoading, setInstanceLoading] = useState(true);
  const [instanceError, setInstanceError] = useState<string | null>(null);

  /* OS selection */
  const [selectedFamily, setSelectedFamily] = useState(OS_FAMILIES[0].key);
  const [selectedVersion, setSelectedVersion] = useState(OS_FAMILIES[0].versions[0]);

  /* Login method */
  const [loginTab, setLoginTab] = useState<"password" | "ssh">("password");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sshKey, setSshKey] = useState("");
  const [showRules, setShowRules] = useState(false);

  /* Risk ack — type instance name to confirm */
  const [confirmText, setConfirmText] = useState("");

  /* Submit */
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = (await vpsApi.getCatalog()) as { blueprints?: Blueprint[] };
        if (cancelled) return;
        setBlueprints(data.blueprints ?? []);
      } catch (err) {
        if (cancelled) return;
        setCatalogError(
          err instanceof Error ? err.message : "Failed to load OS catalog",
        );
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!instanceId) {
      setInstanceLoading(false);
      setInstanceError("Missing instance id.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = (await vpsApi.listInstances()) as { instances: VpsInstance[] };
        if (cancelled) return;
        const found = list.instances.find((i) => i.id === instanceId) ?? null;
        if (!found) setInstanceError("Instance not found.");
        setInstance(found);
      } catch (err) {
        if (cancelled) return;
        setInstanceError(
          err instanceof Error ? err.message : "Failed to load instance",
        );
      } finally {
        if (!cancelled) setInstanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  const currentFamily = OS_FAMILIES.find((f) => f.key === selectedFamily) ?? OS_FAMILIES[0];
  const pwVal = validateVpsPassword(password);
  const matchedBlueprintId = matchBlueprintId(blueprints, selectedVersion);
  const versionAvailability = currentFamily.versions.map((v) => ({
    label: v,
    available: matchBlueprintId(blueprints, v) !== null,
  }));
  const credsValid =
    loginTab === "password"
      ? pwVal.allPassed && password === confirmPw
      : sshKey.trim().length > 0;
  const confirmExpected = (instance?.name ?? "").trim();
  const confirmMatched = confirmExpected.length > 0 && confirmText === confirmExpected;
  const canSubmit =
    confirmMatched &&
    credsValid &&
    matchedBlueprintId !== null &&
    !catalogLoading &&
    !catalogError;

  function selectFamily(key: string) {
    const fam = OS_FAMILIES.find((f) => f.key === key) ?? OS_FAMILIES[0];
    setSelectedFamily(key);
    const firstAvailable = fam.versions.find(
      (v) => matchBlueprintId(blueprints, v) !== null,
    );
    setSelectedVersion(firstAvailable ?? fam.versions[0]);
  }

  async function doReinstall() {
    if (!instanceId) {
      setSubmitError("Missing instance id.");
      setConfirmOpen(false);
      return;
    }
    if (!matchedBlueprintId) {
      setSubmitError("Selected OS image is not available.");
      setConfirmOpen(false);
      return;
    }
    setLoading(true);
    setSubmitError(null);
    try {
      const body: { blueprintId: string; password?: string; keyId?: string } = {
        blueprintId: matchedBlueprintId,
      };
      if (loginTab === "password" && password) body.password = password;
      if (loginTab === "ssh" && sshKey.trim()) {
        // Reinstall expects a Tencent KeyId, but the only thing we have here
        // is a raw public key. Import it first, then pass the resulting KeyId.
        const imported = (await vpsApi.importSshKey(
          `reinstall-${Date.now()}`,
          sshKey.trim(),
        )) as { KeyId?: string };
        if (!imported.KeyId) throw new Error("Imported key did not return an ID");
        body.keyId = imported.KeyId;
      }
      await vpsApi.reinstall(instanceId, body);
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Reinstall failed");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  function handleSubmitClick() {
    if (loginTab === "password") {
      if (!pwVal.allPassed) { setShowRules(true); return; }
      if (password !== confirmPw) {
        setSubmitError("Passwords do not match.");
        return;
      }
    }
    if (loginTab === "ssh" && !sshKey.trim()) {
      setSubmitError("Public key is required.");
      return;
    }
    if (!matchedBlueprintId) {
      setSubmitError("Selected OS image is not available in this region.");
      return;
    }
    if (!confirmMatched) {
      setSubmitError("Type the instance name to confirm the reinstall.");
      return;
    }
    setSubmitError(null);
    setConfirmOpen(true);
  }

  if (success) {
    return (
      <div className="text-white">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-[#1c1c1c]/95 px-4 py-3 backdrop-blur sm:px-6">
          <Link
            href={instanceId ? `/dashboard/vps?instance=${instanceId}` : "/dashboard/vps"}
            aria-label="Back to VPS"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <RotateCw className="h-4 w-4 text-white/40" aria-hidden />
          <h1 className="text-[14px] font-medium text-white">Reinstall VPS</h1>
          <span className="rounded-md border border-red-500/20 bg-red-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-400">
            High Risk
          </span>
        </header>
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3ecf8e]/15">
            <Check className="h-6 w-6 text-[#3ecf8e]" />
          </div>
          <p className="text-[15px] font-medium text-white">Reinstall submitted</p>
          <p className="text-[13px] text-white/40">The instance will be reinstalled with {selectedVersion}.</p>
          <Link
            href="/dashboard/vps"
            className="mt-2 inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            Back to VPS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.06] bg-[#1c1c1c]/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          href={instanceId ? `/dashboard/vps?instance=${instanceId}` : "/dashboard/vps"}
          aria-label="Back to VPS"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <RotateCw className="h-4 w-4 text-white/40" aria-hidden />
        <h1 className="text-[14px] font-medium text-white">Reinstall VPS</h1>
        <span className="rounded-md border border-red-500/20 bg-red-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-400">
          High Risk
        </span>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8 pb-24">
        {/* Step 1: Target instance */}
        <SectionCard step={1} title="Target Instance">
          {instanceLoading ? (
            <p className="text-[13px] text-white/40">Loading instance details…</p>
          ) : instanceError ? (
            <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] p-3 text-[12px] text-red-300">
              {instanceError}
            </div>
          ) : instance ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium text-white">
                    {instance.name || "Unnamed instance"}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-white/35">
                    {instance.external_instance_id}
                  </p>
                </div>
                <StatusBadge status={instance.status} />
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <DetailRow label="Public IP" value={instance.ip_public} mono />
                <DetailRow label="Private IP" value={instance.ip_private} mono />
                <DetailRow label="Region" value={instance.region} />
                <DetailRow label="Current OS" value={instance.os_name} />
                <DetailRow
                  label="Specs"
                  value={
                    instance.cpu && instance.memory_gb
                      ? `${instance.cpu} vCPU · ${instance.memory_gb} GB RAM${
                          instance.system_disk_gb ? ` · ${instance.system_disk_gb} GB disk` : ""
                        }`
                      : null
                  }
                />
                <DetailRow
                  label="Action"
                  value="Full OS reinstall — all data will be erased"
                />
              </div>
            </div>
          ) : null}
        </SectionCard>

        {/* Step 2: Choose image */}
        <SectionCard step={2} title="Choose Reinstall Image">
          {/* OS family grid */}
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {OS_FAMILIES.map((fam) => {
              const active = selectedFamily === fam.key;
              return (
                <button
                  key={fam.key}
                  type="button"
                  onClick={() => selectFamily(fam.key)}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-all ${
                    active
                      ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.06] shadow-[0_0_0_1px_#3ecf8e30]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <Image
                    src={fam.icon}
                    alt={fam.label}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                  <span className={`whitespace-nowrap text-[11px] ${active ? "font-semibold text-white" : "text-white/55"}`}>
                    {fam.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Version select */}
          <div className="mb-4 max-w-xs">
            <VersionDropdown
              value={selectedVersion}
              options={versionAvailability}
              onChange={setSelectedVersion}
              catalogLoading={catalogLoading}
            />
          </div>

          {/* OS description */}
          <div className="rounded-md border border-white/[0.05] bg-white/[0.03] p-4">
            <p className="mb-1 text-[13px] font-medium text-white">{selectedVersion}</p>
            <p className="text-[12px] leading-relaxed text-white/45">{currentFamily.description}</p>
          </div>

          {catalogLoading && (
            <p className="mt-3 text-[12px] text-white/40">Loading available OS images…</p>
          )}
          {catalogError && (
            <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/[0.06] p-3 text-[12px] text-red-300">
              {catalogError}
            </div>
          )}
          {!catalogLoading && !catalogError && !matchedBlueprintId && (
            <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[12px] text-amber-300">
              Selected image is not available in this region. Pick a different version.
            </div>
          )}
        </SectionCard>

        {/* Step 3: Login credential */}
        <SectionCard step={3} title="Login Credential">
          {/* Tab */}
          <div className="mb-5 flex border-b border-white/[0.06]">
            {(["password", "ssh"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setLoginTab(t)}
                className={`mr-4 pb-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                  loginTab === t
                    ? "border-[#3ecf8e] text-white"
                    : "border-transparent text-white/40 hover:text-white/65"
                }`}
              >
                {t === "password" ? "Custom password" : "SSH key"}
              </button>
            ))}
          </div>

          {loginTab === "password" && (
            <div className="space-y-4 rounded-md border border-white/[0.06] bg-[#1c1c1c] p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setShowRules(true)}
                      placeholder="Enter password"
                      className="w-full rounded-md border border-white/[0.08] bg-[#171717] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full rounded-md border bg-[#171717] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:outline-none ${
                        confirmPw && password !== confirmPw
                          ? "border-red-500/50"
                          : "border-white/[0.08] focus:border-[#3ecf8e]/40"
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              {showRules && (
                <div className="rounded-md border border-white/[0.06] bg-[#171717] p-3 text-[12px] space-y-1.5">
                  {[
                    [pwVal.hasLength, "8–30 characters"],
                    [pwVal.noSpaces, "No spaces"],
                    [pwVal.noLeadingSlash, 'Does not start with "/"'],
                    [pwVal.hasThreeSets, "At least 3 character sets (a-z, A-Z, 0-9, special)"],
                  ].map(([pass, label]) => (
                    <div key={label as string} className="flex items-center gap-2 text-white/50">
                      {(pass as boolean) ? (
                        <Check className="h-3.5 w-3.5 text-[#3ecf8e]" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-white/20" />
                      )}
                      <span>{label as string}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {loginTab === "ssh" && (
            <div className="space-y-3">
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Public Key</label>
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                rows={4}
                placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
                className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
              />
            </div>
          )}
        </SectionCard>

        {/* Step 4: Risk acknowledgment */}
        <SectionCard step={4} title="Risk Acknowledgment" tone="danger">
          <div className="space-y-5">
            <div className="flex gap-3 rounded-md border border-red-500/25 bg-red-500/[0.06] p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <div>
                <p className="text-[13px] font-medium text-red-300">
                  This action is destructive and cannot be undone
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-red-300/70">
                  Reinstalling will rebuild the system disk from scratch. Verify you have backups before continuing.
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] uppercase tracking-[0.1em] text-white/35">
                What will happen
              </p>
              <ul className="space-y-1.5 text-[12px] text-white/55">
                {[
                  "All data on the system disk will be permanently erased",
                  "Installed packages, services, and configuration will be wiped",
                  "SSH host keys will regenerate and current sessions will drop",
                  "The instance public IP and ID will be retained",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <X className="mt-0.5 h-3 w-3 shrink-0 text-red-400/80" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">
                Type to confirm
              </label>
              <p className="mb-2 text-[12px] text-white/50">
                Enter{" "}
                <span className="font-mono text-white">
                  {confirmExpected || "the instance name"}
                </span>{" "}
                to enable the reinstall button.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={!confirmExpected}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={confirmExpected || "Loading instance…"}
                  className={`w-full rounded-md border bg-[#1c1c1c] px-3 py-2 pr-9 font-mono text-[13px] text-white placeholder:text-white/20 focus:outline-none disabled:opacity-50 ${
                    confirmMatched
                      ? "border-[#3ecf8e]/40 focus:border-[#3ecf8e]/60"
                      : confirmText.length > 0
                        ? "border-red-500/40 focus:border-red-500/60"
                        : "border-white/[0.08] focus:border-red-500/40"
                  }`}
                />
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-2 w-2 rounded-full transition-colors ${
                    confirmMatched
                      ? "bg-[#3ecf8e]"
                      : confirmText.length > 0
                        ? "bg-red-500"
                        : "bg-white/15"
                  }`}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        {submitError && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] p-3 text-[12px] text-red-300">
            {submitError}
          </div>
        )}
        <div className="flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-white/35">
            {canSubmit
              ? "Ready. Review your selections, then proceed."
              : !confirmMatched
                ? "Type the instance name above to enable the reinstall button."
                : "Complete the previous steps to enable the reinstall button."}
          </p>
          <div className="flex items-center justify-end gap-2">
            <Link
              href="/dashboard/vps"
              className="inline-flex h-9 items-center rounded-md px-4 text-[13px] text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/80"
            >
              Cancel
            </Link>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmitClick}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-500/40 bg-red-500/15 px-4 text-[13px] font-medium text-red-300 transition-colors hover:bg-red-500/25 disabled:cursor-not-allowed disabled:border-red-500/15 disabled:bg-red-500/[0.06] disabled:text-red-400/40"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Reinstall VPS
            </button>
          </div>
        </div>
      </main>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#171717] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">Confirm reinstall</h3>
              <button type="button" onClick={() => setConfirmOpen(false)} className="text-white/35 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-6 text-[13px] leading-relaxed text-white/55">
              You are about to reinstall{" "}
              <strong className="text-white">{instance?.name || instanceId}</strong>
              {instance?.ip_public ? (
                <>
                  {" "}(<span className="font-mono text-white/70">{instance.ip_public}</span>)
                </>
              ) : null}
              {" "}with <strong className="text-white">{selectedVersion}</strong>.
              All current data will be erased. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-md border border-white/[0.08] py-2 text-[13px] text-white/55 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doReinstall}
                disabled={loading}
                className="flex-1 rounded-md border border-red-500/30 bg-red-500/10 py-2 text-[13px] font-medium text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
              >
                {loading ? "Submitting…" : "Confirm reinstall"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReinstallPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[13px] text-white/30">Loading…</div>}>
      <ReinstallContent />
    </Suspense>
  );
}
