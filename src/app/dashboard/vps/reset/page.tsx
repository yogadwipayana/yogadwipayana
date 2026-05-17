"use client";

import { Suspense, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  Key,
  Lock,
} from "lucide-react";
import type { Metadata } from "next";

/* -------------------------------------------------------------------------- */
/*  Password validation                                                        */
/* -------------------------------------------------------------------------- */

const SPECIAL_RE = /[`~!@#$%^&*()\-_=+[\]{};:'",.<>?/\\|]/;

function validatePassword(pw: string) {
  const hasLength = pw.length >= 8 && pw.length <= 30;
  const noSpaces = !pw.includes(" ");
  const noLeadingSlash = !pw.startsWith("/");
  const sets = [/[a-z]/, /[A-Z]/, /[0-9]/, SPECIAL_RE].filter((r) => r.test(pw)).length;
  const allPassed = hasLength && noSpaces && noLeadingSlash && sets >= 3;
  return { hasLength, noSpaces, noLeadingSlash, hasThreeSets: sets >= 3, allPassed };
}

function generatePassword() {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~";
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

/* -------------------------------------------------------------------------- */
/*  Rule indicator                                                             */
/* -------------------------------------------------------------------------- */

function RuleIndicator({ pass, started }: { pass: boolean; started: boolean }) {
  if (!started) return <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/25" />;
  return pass ? (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#3ecf8e] text-[9px] font-bold text-[#171717]">
      ✓
    </span>
  ) : (
    <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-red-500" />
  );
}

/* -------------------------------------------------------------------------- */
/*  Page header                                                                */
/* -------------------------------------------------------------------------- */

function PageHeader({ backHref, title }: { backHref: string; title: string }) {
  return (
    <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
      <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-6">
        <Link
          href={backHref}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-[15px] font-medium text-white">{title}</h1>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Reset content                                                              */
/* -------------------------------------------------------------------------- */

type Tab = "password" | "ssh";

function ResetContent() {
  const params = useSearchParams();
  const instanceId = params.get("id") ?? "";
  const backHref = instanceId ? `/dashboard/vps?instance=${instanceId}` : "/dashboard/vps";

  const [tab, setTab] = useState<Tab>("password");

  /* password state */
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [ackRestart, setAckRestart] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwMatchError, setPwMatchError] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const hideRulesRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHideRules = useCallback(() => setShowRules(false), []);

  /* ssh state */
  const [keyName, setKeyName] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [sshLoading, setSshLoading] = useState(false);
  const [sshSuccess, setSshSuccess] = useState(false);
  const [sshError, setSshError] = useState<string | null>(null);

  const pwVal = validatePassword(newPw);
  const started = newPw.length > 0;

  function handleGenerate() {
    const pw = generatePassword();
    setNewPw(pw);
    setConfirmPw(pw);
    setShowNew(true);
    setShowConfirm(true);
    if (hideRulesRef.current) clearTimeout(hideRulesRef.current);
    hideRulesRef.current = setTimeout(() => {
      setShowNew(false);
      setShowConfirm(false);
    }, 3000);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pwVal.allPassed) { setShowRules(true); return; }
    if (newPw !== confirmPw) { setPwMatchError(true); return; }
    setPwLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    setPwSuccess(true);
    setPwLoading(false);
  }

  async function handleSshSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim() || !publicKey.trim()) {
      setSshError("Key name and public key are required.");
      return;
    }
    setSshLoading(true);
    await new Promise((r) => setTimeout(r, 900));
    setSshSuccess(true);
    setSshLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#1c1c1c] text-white">
      <PageHeader backHref={backHref} title="Server Access" />

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Tab switcher */}
        <div className="mb-8 flex rounded-lg bg-white/[0.04] p-1">
          {(["password", "ssh"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-2.5 text-[13px] font-medium transition-all ${
                tab === t
                  ? "bg-[#171717] text-white shadow-sm"
                  : "text-white/45 hover:text-white/70"
              }`}
            >
              {t === "password" ? "Reset Password" : "Bind SSH Key"}
            </button>
          ))}
        </div>

        {/* ── Reset password ── */}
        {tab === "password" && (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="text-[13px] font-medium text-amber-300">Important warning</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-amber-300/70">
                  Resetting the password will <strong>force restart</strong> the instance immediately.
                  Save all critical work before proceeding.
                </p>
              </div>
            </div>

            {pwSuccess ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] p-4">
                <Check className="h-4 w-4 text-[#3ecf8e]" />
                <p className="text-[13px] text-[#3ecf8e]">Password reset submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4 text-[#3ecf8e]" />
                    <h2 className="text-[15px] font-medium text-white">Reset Instance Password</h2>
                  </div>

                  {/* Username */}
                  <Field label="Username">
                    <input
                      disabled
                      value="ubuntu"
                      className="w-full cursor-not-allowed rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-white/40"
                    />
                    <p className="mt-1.5 text-[11px] text-white/30">
                      You are changing the password for the ubuntu user.
                    </p>
                  </Field>

                  {/* New password */}
                  <Field label="New Password">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-[0.1em] text-white/35">New Password</span>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="text-[12px] font-medium text-[#3ecf8e] hover:text-[#24b47e] transition-colors"
                      >
                        Generate strong password
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => { setNewPw(e.target.value); setPwError(null); }}
                        onFocus={() => setShowRules(true)}
                        required
                        placeholder="Min. 8 characters"
                        className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60"
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {showRules && (
                      <div className="mt-2 rounded-md border border-white/[0.06] bg-[#1c1c1c] p-3 text-[12px] space-y-1.5">
                        {[
                          [pwVal.hasLength, "8–30 characters"],
                          [pwVal.noSpaces, "No spaces"],
                          [pwVal.noLeadingSlash, 'Does not start with "/"'],
                          [pwVal.hasThreeSets, "At least 3 of: a-z, A-Z, 0-9, special chars"],
                        ].map(([pass, label]) => (
                          <div key={label as string} className="flex items-center gap-2 text-white/55">
                            <RuleIndicator pass={pass as boolean} started={started} />
                            <span>{label as string}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Field>

                  {/* Confirm password */}
                  <Field label="Confirm Password">
                    <div className="relative">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPw}
                        onChange={(e) => { setConfirmPw(e.target.value); setPwMatchError(false); }}
                        required
                        placeholder="Repeat password"
                        className={`w-full rounded-md border px-3 py-2 pr-10 text-[13px] text-white placeholder:text-white/20 bg-[#1c1c1c] focus:outline-none ${
                          pwMatchError
                            ? "border-red-500/50 focus:border-red-500/70"
                            : "border-white/[0.08] focus:border-[#3ecf8e]/40"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/60"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {pwMatchError && (
                      <p className="mt-1 text-[12px] text-red-400">Passwords do not match.</p>
                    )}
                    {pwError && <p className="mt-1 text-[12px] text-red-400">{pwError}</p>}
                  </Field>

                  {/* Acknowledgment */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ackRestart}
                      onChange={(e) => setAckRestart(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/25 bg-transparent accent-[#3ecf8e]"
                    />
                    <span className="text-[13px] leading-relaxed text-white/60">
                      I understand that resetting the password will force restart the instance.
                    </span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={backHref}
                    className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/80"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={pwLoading || !ackRestart}
                    className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {pwLoading ? "Resetting…" : "Reset Password"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── Bind SSH key ── */}
        {tab === "ssh" && (
          <div className="space-y-5">
            {sshSuccess ? (
              <div className="flex items-center gap-3 rounded-lg border border-[#3ecf8e]/20 bg-[#3ecf8e]/[0.06] p-4">
                <Check className="h-4 w-4 text-[#3ecf8e]" />
                <p className="text-[13px] text-[#3ecf8e]">SSH key imported and bind submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={handleSshSubmit} className="space-y-5">
                <div className="rounded-lg border border-white/[0.08] bg-[#171717] p-6 space-y-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-[#3ecf8e]" />
                      <h2 className="text-[15px] font-medium text-white">Bind SSH Key</h2>
                    </div>
                    <a
                      href="#"
                      className="flex items-center gap-1 text-[12px] text-[#3ecf8e] hover:text-[#24b47e]"
                    >
                      Learn more <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <Field label="Key Name">
                    <input
                      type="text"
                      value={keyName}
                      onChange={(e) => { setKeyName(e.target.value); setSshError(null); }}
                      placeholder="e.g. macbook-personal"
                      className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                    />
                  </Field>

                  <Field label="Public Key">
                    <textarea
                      value={publicKey}
                      onChange={(e) => { setPublicKey(e.target.value); setSshError(null); }}
                      rows={4}
                      placeholder="ssh-rsa AAAAB3... or ssh-ed25519 AAAAC3..."
                      className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none"
                    />
                  </Field>

                  {sshError && (
                    <p className="text-[12px] text-red-400">{sshError}</p>
                  )}

                  <p className="text-[12px] leading-relaxed text-white/35">
                    The public key will be imported to your account and bound to this instance.
                    The instance will briefly restart during the bind operation.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <Link
                    href={backHref}
                    className="inline-flex h-9 items-center rounded-md border border-white/[0.08] px-4 text-[13px] text-white/55 transition-colors hover:bg-white/[0.04] hover:text-white/80"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={sshLoading}
                    className="inline-flex h-9 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-50"
                  >
                    {sshLoading ? "Binding…" : "Import & Bind"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helper                                                                     */
/* -------------------------------------------------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">
        {label}
      </label>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Export                                                                     */
/* -------------------------------------------------------------------------- */

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1c1c1c] p-8 text-center text-[13px] text-white/30">
          Loading…
        </div>
      }
    >
      <ResetContent />
    </Suspense>
  );
}
