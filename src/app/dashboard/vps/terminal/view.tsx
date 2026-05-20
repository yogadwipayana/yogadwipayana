"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TerminalSquare } from "lucide-react";
import { SshTerminal } from "./terminal";

export type InstanceOption = {
  id: string;
  name: string;
  ip_public: string | null;
  ip_private: string | null;
};

type AuthMethod = "password" | "key";
type Status = "idle" | "connecting" | "connected" | "error" | "closed";

type SaveIndicator = "idle" | "saving" | "saved" | "error";

interface ConnectConfig {
  instanceId: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

type SafeCred = {
  instanceId: string;
  userId: string;
  username: string;
  port: number;
  authMethod: "password" | "key";
  hasPassword: boolean;
  hasPrivateKey: boolean;
  hasPassphrase: boolean;
  hostOverride?: string;
  updatedAt: string;
};

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  type = "text",
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1.5 text-[13px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none disabled:opacity-50"
    />
  );
}

export function SshTerminalView({ instances }: { instances: InstanceOption[] }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");

  // form fields
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [host, setHost] = useState(instances[0]?.ip_public ?? "");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("root");
  const [password, setPassword] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // saved credential state
  const [savedCred, setSavedCred] = useState<SafeCred | null>(null);
  const [credLoading, setCredLoading] = useState(false);
  // tracks whether the user has manually edited any field after cred load
  const userEditedRef = useRef(false);

  // save-on-connect
  const [saveCredentials, setSaveCredentials] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("idle");

  // active config sent to terminal
  const [config, setConfig] = useState<ConnectConfig | null>(null);

  // ── fetch saved credential whenever instanceId changes ──────────────────────
  useEffect(() => {
    if (!instanceId) return;
    userEditedRef.current = false;
    setSavedCred(null);
    setCredLoading(true);
    setSaveIndicator("idle");

    const controller = new AbortController();

    fetch(`/api/vps/instances/${instanceId}/ssh-credential`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { credential: SafeCred | null };
        return body.credential ?? null;
      })
      .then((cred) => {
        if (controller.signal.aborted) return;
        setSavedCred(cred);
        if (cred && !userEditedRef.current) {
          setUsername(cred.username);
          setPort(String(cred.port));
          setAuthMethod(cred.authMethod);
          if (cred.hostOverride) setHost(cred.hostOverride);
          // never pre-fill secrets — password/privateKey/passphrase stay empty
        }
      })
      .catch(() => {
        // aborted or network error — silently ignore
      })
      .finally(() => {
        if (!controller.signal.aborted) setCredLoading(false);
      });

    return () => {
      controller.abort();
      setCredLoading(false);
    };
  }, [instanceId]);

  // ── mark user-edited when they type in any field ────────────────────────────
  function markEdited() {
    userEditedRef.current = true;
  }

  function handleInstanceChange(id: string) {
    setInstanceId(id);
    const inst = instances.find((i) => i.id === id);
    if (inst) setHost(inst.ip_public ?? inst.ip_private ?? "");
  }

  function validate(): string | null {
    if (!username.trim()) return "Username is required.";
    if (!host.trim()) return "Host is required.";
    if (authMethod === "password" && !password.trim()) return "Password is required.";
    if (authMethod === "key" && !privateKey.trim()) return "Private key is required.";
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) return "Port must be 1–65535.";
    return null;
  }

  function handleConnect() {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      setStatus("error");
      return;
    }
    const cfg: ConnectConfig = {
      instanceId,
      host: host.trim(),
      port: parseInt(port, 10),
      username: username.trim(),
      authMethod,
      password: authMethod === "password" ? password : undefined,
      privateKey: authMethod === "key" ? privateKey : undefined,
      passphrase: authMethod === "key" && passphrase ? passphrase : undefined,
    };
    setConfig(cfg);
    setStatus("connecting");
    setSaveIndicator("idle");
  }

  function handleDisconnect() {
    setConfig(null);
    setStatus("closed");
  }

  async function persistCredential() {
    if (!instanceId) return;
    setSaveIndicator("saving");
    try {
      const body: Record<string, unknown> = {
        username: username.trim(),
        port: parseInt(port, 10),
        authMethod,
        hostOverride: host.trim() !== (instances.find((i) => i.id === instanceId)?.ip_public ?? "") ? host.trim() : undefined,
      };
      if (authMethod === "password" && password) body.password = password;
      if (authMethod === "key" && privateKey) body.privateKey = privateKey;
      if (authMethod === "key" && passphrase) body.passphrase = passphrase;

      const res = await fetch(`/api/vps/instances/${instanceId}/ssh-credential`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("save failed");
      const data = (await res.json()) as { credential: SafeCred };
      setSavedCred(data.credential);
      setSaveIndicator("saved");
    } catch {
      setSaveIndicator("error");
    }
  }

  async function handleForget() {
    if (!instanceId) return;
    try {
      await fetch(`/api/vps/instances/${instanceId}/ssh-credential`, {
        method: "DELETE",
      });
    } catch {
      // best-effort
    }
    setSavedCred(null);
    setSaveIndicator("idle");
    setPassword("");
    setPrivateKey("");
    setPassphrase("");
  }

  function handleStatus(s: "connecting" | "ready" | "error" | "closed", message?: string) {
    if (s === "ready") {
      setStatus("connected");
      if (saveCredentials) {
        persistCredential();
      }
    } else if (s === "error") {
      setErrorMsg(message ?? "Connection error.");
      setStatus("error");
      setConfig(null);
    } else if (s === "closed") {
      setStatus("closed");
      setConfig(null);
    }
  }

  const isLocked = status === "connecting" || status === "connected";

  // placeholder text for secret fields when a saved cred exists
  const passwordPlaceholder =
    savedCred?.hasPassword ? "(saved — type to override)" : "Enter password";
  const privateKeyPlaceholder =
    savedCred?.hasPrivateKey ? "(saved — type to override)" : "-----BEGIN OPENSSH PRIVATE KEY-----";
  const passphrasePlaceholder =
    savedCred?.hasPassphrase ? "(saved — type to override)" : "Leave blank if none";

  return (
    <div className="min-h-screen bg-[#1c1c1c] pb-24 text-white">
      <header className="border-b border-white/[0.06] bg-[#0f0f0f]">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/dashboard/vps"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <TerminalSquare className="h-4 w-4 text-white/40" />
          <h1 className="text-[15px] font-medium text-white">SSH Terminal</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
        {/* Connect form — shown when idle, error, or closed */}
        {(status === "idle" || status === "error" || status === "closed") && (
          <div className="space-y-4 rounded-lg border border-white/[0.08] bg-[#171717] p-4">
            <span className="text-[13px] font-medium text-white/65">
              {status === "closed" ? "Reconnect" : "Connect to instance"}
            </span>

            {status === "error" && (
              <div className="rounded-md border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-400">
                {errorMsg}
              </div>
            )}

            {status === "closed" && (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[12px] text-white/45">
                Connection closed.
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {instances.length > 0 && (
                <FieldGroup label="Instance">
                  <select
                    value={instanceId}
                    onChange={(e) => handleInstanceChange(e.target.value)}
                    disabled={isLocked}
                    className="w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-2.5 py-1.5 text-[13px] text-white focus:border-[#3ecf8e]/40 focus:outline-none disabled:opacity-50"
                  >
                    {instances.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} {i.ip_public ? `(${i.ip_public})` : ""}
                      </option>
                    ))}
                  </select>
                </FieldGroup>
              )}

              <FieldGroup label="Host / IP">
                <FormInput
                  value={host}
                  onChange={(v) => { markEdited(); setHost(v); }}
                  placeholder="192.168.1.1"
                  disabled={isLocked}
                />
              </FieldGroup>

              <FieldGroup label="Port">
                <FormInput
                  value={port}
                  onChange={(v) => { markEdited(); setPort(v); }}
                  placeholder="22"
                  disabled={isLocked}
                />
              </FieldGroup>

              <FieldGroup label="Username">
                <FormInput
                  value={username}
                  onChange={(v) => { markEdited(); setUsername(v); }}
                  placeholder="root"
                  disabled={isLocked}
                />
              </FieldGroup>
            </div>

            {/* Auth method tabs + saved cred indicator */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.1em] text-white/35">
                Auth Method
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-md border border-white/[0.08] bg-[#1c1c1c] p-0.5 w-fit">
                  {(["password", "key"] as AuthMethod[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={isLocked}
                      onClick={() => { markEdited(); setAuthMethod(m); }}
                      className={`rounded px-3 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                        authMethod === m
                          ? "bg-white/[0.08] text-white"
                          : "text-white/45 hover:text-white/70"
                      }`}
                    >
                      {m === "password" ? "Password" : "Private Key"}
                    </button>
                  ))}
                </div>
                {credLoading && (
                  <span className="text-[11px] text-white/30">Loading saved credentials…</span>
                )}
                {!credLoading && savedCred && (
                  <span className="text-[11px] text-[#3ecf8e]/80">Saved credentials loaded</span>
                )}
              </div>
            </div>

            {authMethod === "password" ? (
              <FieldGroup label="Password">
                <textarea
                  value={password}
                  onChange={(e) => { markEdited(); setPassword(e.target.value); }}
                  rows={2}
                  disabled={isLocked}
                  placeholder={passwordPlaceholder}
                  className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none disabled:opacity-50"
                />
              </FieldGroup>
            ) : (
              <div className="space-y-3">
                <FieldGroup label="Private Key">
                  <textarea
                    value={privateKey}
                    onChange={(e) => { markEdited(); setPrivateKey(e.target.value); }}
                    rows={5}
                    disabled={isLocked}
                    placeholder={privateKeyPlaceholder}
                    className="w-full resize-none rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 font-mono text-[12px] text-white placeholder:text-white/20 focus:border-[#3ecf8e]/40 focus:outline-none disabled:opacity-50"
                  />
                </FieldGroup>
                <FieldGroup label="Passphrase (optional)">
                  <FormInput
                    value={passphrase}
                    onChange={(v) => { markEdited(); setPassphrase(v); }}
                    placeholder={passphrasePlaceholder}
                    type="password"
                    disabled={isLocked}
                  />
                </FieldGroup>
              </div>
            )}

            {/* Save credentials row */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveCredentials}
                  onChange={(e) => {
                    setSaveCredentials(e.target.checked);
                    setSaveIndicator("idle");
                  }}
                  disabled={isLocked}
                  className="h-3.5 w-3.5 rounded border border-white/[0.15] bg-[#1c1c1c] accent-[#3ecf8e] disabled:opacity-50"
                />
                <span className="text-[12px] text-white/55">Save credentials</span>
              </label>

              {saveIndicator === "saving" && (
                <span className="text-[11px] text-white/35">Saving…</span>
              )}
              {saveIndicator === "saved" && (
                <span className="text-[11px] text-[#3ecf8e]">Saved</span>
              )}
              {saveIndicator === "error" && (
                <span className="text-[11px] text-red-400">Failed to save</span>
              )}

              {savedCred && (
                <button
                  type="button"
                  onClick={handleForget}
                  disabled={isLocked}
                  className="inline-flex h-6 items-center rounded border border-white/[0.08] px-2 text-[11px] text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400 disabled:opacity-50"
                >
                  Forget saved credentials
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleConnect}
              disabled={isLocked}
              className="inline-flex h-8 items-center rounded-md bg-[#3ecf8e] px-4 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e] disabled:opacity-60"
            >
              {status === "closed" ? "Reconnect" : "Connect"}
            </button>
          </div>
        )}

        {/* Connecting state */}
        {status === "connecting" && (
          <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[13px] text-white/55">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#3ecf8e]" />
            Connecting…
          </div>
        )}

        {/* Terminal */}
        {(status === "connecting" || status === "connected") && config && (
          <div className="overflow-hidden rounded-lg border border-white/[0.08]">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#0f0f0f] px-4 py-2">
              <span className="font-mono text-[12px] text-white/40">
                {config.username}@{config.host}:{config.port}
              </span>
              <button
                type="button"
                onClick={handleDisconnect}
                className="inline-flex h-7 items-center rounded-md border border-white/[0.08] px-3 text-[12px] text-white/55 transition-colors hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400"
              >
                Disconnect
              </button>
            </div>
            <SshTerminal config={config} onStatus={handleStatus} />
          </div>
        )}
      </main>
    </div>
  );
}
