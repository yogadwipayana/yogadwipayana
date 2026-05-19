"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cpu,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

import { vpsApi } from "@/lib/client/vps-api";
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

function PageHeader({ backHref }: { backHref: string }) {
  return (
    <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
        <Link
          href={backHref}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-medium text-white">Reinstall VPS</h1>
          <span className="rounded-md border border-red-500/20 bg-red-500/[0.08] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-red-400">
            High Risk
          </span>
        </div>
      </div>
    </header>
  );
}

function SectionCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717]">
      <div className="border-b border-white/[0.05] px-6 py-3.5">
        <h2 className="flex items-center gap-2.5 text-[14px] font-medium text-white">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/60">
            {step}
          </span>
          {title}
        </h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main content                                                               */
/* -------------------------------------------------------------------------- */

function ReinstallContent() {
  const params = useSearchParams();
  const instanceId = params.get("id") ?? "";
  const backHref = `/dashboard/vps`;

  /* Catalog of available blueprints from Tencent */
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

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

  /* Risk ack */
  const [risk1, setRisk1] = useState(false);
  const [risk2, setRisk2] = useState(false);

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
  const canSubmit =
    risk1 &&
    risk2 &&
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
    setSubmitError(null);
    setConfirmOpen(true);
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#1c1c1c] text-white">
        <PageHeader backHref={backHref} />
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3ecf8e]/15">
            <Check className="h-6 w-6 text-[#3ecf8e]" />
          </div>
          <p className="text-[15px] font-medium text-white">Reinstall submitted</p>
          <p className="text-[13px] text-white/40">The instance will be reinstalled with {selectedVersion}.</p>
          <Link
            href={backHref}
            className="mt-2 inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/60 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            Back to VPS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-white">
      <PageHeader backHref={backHref} />

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8 pb-24">
        {/* Step 1: Target instance */}
        <SectionCard step={1} title="Target Instance">
          <div className="grid grid-cols-[120px_1fr] gap-y-3 text-[13px]">
            <span className="text-white/40">Instance ID</span>
            <span className="font-mono text-white/70">{instanceId}</span>
            <span className="text-white/40">Action</span>
            <span className="text-white">Full OS reinstall — all data will be erased</span>
          </div>
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
            <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 focus-within:border-[#3ecf8e]/40">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-white/35" />
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full bg-transparent text-[13px] text-white focus:outline-none"
              >
                {versionAvailability.map((v) => (
                  <option key={v.label} value={v.label} disabled={!v.available}>
                    {v.label}
                    {!v.available && !catalogLoading ? " — not available" : ""}
                  </option>
                ))}
              </select>
            </div>
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
        <SectionCard step={4} title="Risk Acknowledgment">
          <div className="mb-5 flex gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] p-4">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <p className="text-[13px] leading-relaxed text-red-300/80">
              Reinstalling will <strong className="text-red-300">permanently erase all data</strong> on the system disk.
              This operation cannot be undone.
            </p>
          </div>
          <div className="space-y-3">
            {[
              [risk1, setRisk1, "I understand that all data on the system disk will be permanently erased."],
              [risk2, setRisk2, "I confirm that I have backed up any important data before proceeding."],
            ].map(([val, setter, label], i) => (
              <label key={i} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={val as boolean}
                  onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/25 bg-transparent accent-[#3ecf8e]"
                />
                <span className="text-[13px] leading-relaxed text-white/60">{label as string}</span>
              </label>
            ))}
          </div>
        </SectionCard>

        {/* Actions */}
        {submitError && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] p-3 text-[12px] text-red-300">
            {submitError}
          </div>
        )}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={backHref}
            className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 hover:bg-white/[0.04] hover:text-white/80 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmitClick}
            className="inline-flex h-9 items-center rounded-md border border-red-500/30 bg-red-500/10 px-4 text-[13px] font-medium text-red-400 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reinstall VPS
          </button>
        </div>
      </main>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#171717] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-white">Confirm reinstall</h3>
              <button onClick={() => setConfirmOpen(false)} className="text-white/35 hover:text-white/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-6 text-[13px] leading-relaxed text-white/55">
              You are about to reinstall <strong className="text-white">{instanceId}</strong> with{" "}
              <strong className="text-white">{selectedVersion}</strong>.
              All current data will be erased. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-md border border-white/[0.08] py-2 text-[13px] text-white/55 hover:bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
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
    <Suspense fallback={<div className="min-h-screen bg-[#1c1c1c] p-8 text-center text-[13px] text-white/30">Loading…</div>}>
      <ReinstallContent />
    </Suspense>
  );
}
