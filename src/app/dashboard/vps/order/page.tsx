"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  MemoryStick,
  Shield,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Static data                                                                */
/* -------------------------------------------------------------------------- */

const OS_OPTIONS = [
  { key: "ubuntu",    label: "Ubuntu",        icon: "/images/Ubuntu.svg",       versions: ["Ubuntu 24.04 LTS", "Ubuntu 22.04 LTS", "Ubuntu 20.04 LTS"], description: "Ubuntu LTS gives broad ecosystem support, predictable long-term updates, and easy automation for common web and container workloads." },
  { key: "debian",    label: "Debian",        icon: "/images/Debian.svg",       versions: ["Debian 12", "Debian 11"],                                    description: "Debian offers excellent stability and a conservative package policy — reliable for production services." },
  { key: "centos",    label: "CentOS Stream", icon: "/images/CentOSStream.svg", versions: ["CentOS Stream 9", "CentOS Stream 8"],                        description: "CentOS Stream tracks upcoming RHEL updates — newer packages with enterprise-like behavior." },
  { key: "rocky",     label: "Rocky Linux",   icon: "/images/Rockylinux.svg",   versions: ["Rocky Linux 9", "Rocky Linux 8"],                           description: "Rocky Linux is enterprise-grade and RHEL-compatible, designed for stability and smooth CentOS migration." },
  { key: "opencloud", label: "OpenCloudOS",   icon: "/images/opencloud.svg",    versions: ["OpenCloudOS 9", "OpenCloudOS 8"],                           description: "OpenCloudOS is optimised for cloud-native workloads with long-term enterprise support." },
] as const;

const PLAN_SPECS = [
  { icon: Cpu,        label: "2 vCPU Core" },
  { icon: MemoryStick,label: "2 GB RAM" },
  { icon: HardDrive,  label: "40 GB SSD" },
  { icon: Activity,   label: "512 GB/month transfer (20 Mbps)" },
  { icon: Globe,      label: "1 Public IP" },
  { icon: Shield,     label: "Full root access" },
];

const PRICE_IDR = 35_000;

/* -------------------------------------------------------------------------- */
/*  Password validation                                                        */
/* -------------------------------------------------------------------------- */

const SPECIAL_RE = /[`~!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|]/;

function validatePassword(pw: string) {
  const sets = [/[a-z]/, /[A-Z]/, /[0-9]/, SPECIAL_RE].filter((r) => r.test(pw)).length;
  return pw.length >= 8 && pw.length <= 30 && !pw.includes(" ") && !pw.startsWith("/") && sets >= 3;
}

/* -------------------------------------------------------------------------- */
/*  UI helpers                                                                 */
/* -------------------------------------------------------------------------- */

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

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">{label}</label>
      {children}
      {helper && <p className="mt-1.5 text-[11px] text-white/30">{helper}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function OrderVpsPage() {
  const router = useRouter();

  /* OS */
  const [selectedOs, setSelectedOs] = useState(0);
  const [selectedVersion, setSelectedVersion] = useState<string>(OS_OPTIONS[0].versions[0]);

  /* Config */
  const [instanceName, setInstanceName] = useState("ubuntu-1");
  const [nameError, setNameError] = useState<string | null>(null);
  const [credTab, setCredTab] = useState<"password" | "ssh">("password");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sshKey, setSshKey] = useState("");

  /* Submit */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOsSelect(i: number) {
    setSelectedOs(i);
    setSelectedVersion(OS_OPTIONS[i].versions[0]);
  }

  function validateName(name: string): string | null {
    if (!name.trim()) return "Instance name is required.";
    if (!/^[a-zA-Z][a-zA-Z0-9\-]*$/.test(name)) return "Only letters, numbers, and hyphens. Must start with a letter.";
    if (name.length > 40) return "Maximum 40 characters.";
    return null;
  }

  async function handlePay() {
    const nameErr = validateName(instanceName);
    if (nameErr) { setNameError(nameErr); return; }
    if (credTab === "password") {
      if (!password) { setError("Password is required."); return; }
      if (!validatePassword(password)) { setError("Password does not meet requirements."); return; }
      if (password !== confirmPw) { setError("Passwords do not match."); return; }
    }
    if (credTab === "ssh" && !sshKey.trim()) { setError("SSH public key is required."); return; }

    setError(null);
    setLoading(true);
    /* Simulate order creation → redirect to payment */
    await new Promise((r) => setTimeout(r, 700));
    router.push("/dashboard/vps/payment?orderId=demo-order-001");
  }

  const currentOs = OS_OPTIONS[selectedOs];

  return (
    <div className="min-h-screen bg-[#1c1c1c] pb-24 text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
          <Link
            href="/dashboard/vps"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[15px] font-medium text-white">Deploy New Instance</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-6 py-8">
        {error && (
          <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        )}

        {/* 1. Region */}
        <SectionCard step={1} title="Region">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.05] p-4 text-center shadow-[0_0_0_1px_#3ecf8e30]">
              <div className="mb-2 text-2xl">🇮🇩</div>
              <div className="text-[13px] font-semibold text-white">Jakarta</div>
              <div className="mt-0.5 text-[11px] text-white/40">ap-jakarta</div>
            </div>
            {["Singapore 🇸🇬", "Frankfurt 🇩🇪", "US West 🇺🇸"].map((r) => (
              <div key={r} className="cursor-not-allowed rounded-lg border border-white/[0.06] p-4 text-center opacity-40">
                <div className="mb-2 text-2xl">{r.split(" ")[1]}</div>
                <div className="text-[13px] font-medium text-white/50">{r.split(" ")[0]}</div>
                <div className="mt-0.5 text-[10px] text-white/25">Soon</div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 2. OS Image */}
        <SectionCard step={2} title="Choose Image (OS)">
          <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {OS_OPTIONS.map((os, i) => {
              const active = selectedOs === i;
              return (
                <button
                  key={os.key}
                  type="button"
                  onClick={() => handleOsSelect(i)}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-all ${
                    active
                      ? "border-[#3ecf8e]/30 bg-[#3ecf8e]/[0.05] shadow-[0_0_0_1px_#3ecf8e30]"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                  }`}
                >
                  <Image
                    src={os.icon}
                    alt={os.label}
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                  <span className={`whitespace-nowrap text-[11px] ${active ? "font-semibold text-white" : "text-white/50"}`}>
                    {os.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 max-w-xs">
            <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 focus-within:border-[#3ecf8e]/40">
              <Cpu className="h-3.5 w-3.5 shrink-0 text-white/35" />
              <select
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
                className="w-full bg-transparent text-[13px] text-white focus:outline-none"
              >
                {currentOs.versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-4">
            <p className="mb-1 text-[13px] font-medium text-white">{selectedVersion}</p>
            <p className="text-[12px] leading-relaxed text-white/40">{currentOs.description}</p>
          </div>
        </SectionCard>

        {/* 3. Plan */}
        <SectionCard step={3} title="Choose Plan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="relative rounded-xl border border-[#3ecf8e]/25 bg-[#3ecf8e]/[0.04] p-5 shadow-[0_0_0_1px_#3ecf8e25]">
              <span className="absolute -top-3 left-4 rounded-md bg-[#3ecf8e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#171717]">
                VPS Starter
              </span>
              <div className="flex items-start justify-between mb-4 mt-1">
                <div>
                  <p className="text-[12px] text-white/50 mt-1">
                    Stable resource for websites and apps.
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-[22px] font-bold leading-none text-[#3ecf8e]">
                    Rp{PRICE_IDR.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[11px] text-white/40">/month</span>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-y-2.5 gap-x-2 border-t border-white/[0.06] pt-4">
                {PLAN_SPECS.map((s) => (
                  <li key={s.label} className="flex items-center gap-2 text-[12px] text-white/55">
                    <s.icon className="h-3.5 w-3.5 shrink-0 rounded border border-white/[0.1] p-0.5 text-white/40" />
                    {s.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* 4. Configuration */}
        <SectionCard step={4} title="System Configuration">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Instance Name" helper="Letters, numbers, hyphens. Starts with a letter.">
              <input
                type="text"
                value={instanceName}
                onChange={(e) => { setInstanceName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
                onBlur={() => setNameError(validateName(instanceName))}
                className={`w-full rounded-md border px-3 py-2 text-[13px] text-white bg-[#1c1c1c] placeholder:text-white/20 focus:outline-none ${
                  nameError ? "border-red-500/50" : "border-white/[0.08] focus:border-[#3ecf8e]/40"
                }`}
              />
              {nameError && <p className="mt-1 text-[12px] text-red-400">{nameError}</p>}
            </Field>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[13px] font-medium text-white">Login Credential</span>
              <Info className="h-3.5 w-3.5 text-white/30" />
            </div>

            <div className="mb-4 flex border-b border-white/[0.06]">
              {(["password", "ssh"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCredTab(t)}
                  className={`mr-4 pb-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                    credTab === t ? "border-[#3ecf8e] text-white" : "border-transparent text-white/40 hover:text-white/65"
                  }`}
                >
                  {t === "password" ? "Custom password" : "SSH key"}
                </button>
              ))}
            </div>

            {credTab === "password" && (
              <div className="grid gap-4 rounded-md border border-white/[0.06] bg-[#1c1c1c] p-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full rounded-md border border-white/[0.08] bg-[#171717] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                    />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">Confirm</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Repeat password"
                      className={`w-full rounded-md border bg-[#171717] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:outline-none ${
                        confirmPw && password !== confirmPw ? "border-red-500/50" : "border-white/[0.08] focus:border-[#3ecf8e]/40"
                      }`}
                    />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {credTab === "ssh" && (
              <textarea
                value={sshKey}
                onChange={(e) => setSshKey(e.target.value)}
                rows={4}
                placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
                className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
              />
            )}
          </div>
        </SectionCard>

        {/* Order summary + CTA */}
        <div className="flex flex-col items-end gap-4 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-white/[0.06] bg-[#171717] p-5">
          <div>
            <p className="text-[12px] text-white/40">Total per month</p>
            <p className="text-[22px] font-bold text-[#3ecf8e]">Rp{PRICE_IDR.toLocaleString("id-ID")}</p>
            <p className="text-[11px] text-white/30">VPS Starter · Jakarta · {selectedVersion}</p>
          </div>
          <button
            type="button"
            onClick={handlePay}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3ecf8e] px-5 text-[14px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
          >
            {loading ? "Processing…" : "Proceed to Payment"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </main>
    </div>
  );
}
