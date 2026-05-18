"use client";

import { useId, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

type PasswordFieldProps = {
  id?: string;
  name: string;
  label: string;
  placeholder?: string;
  autoComplete?: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  labelSlot?: React.ReactNode;
  invalid?: boolean;
  value?: string;
  onChange?: (v: string) => void;
};

export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete = "current-password",
  required,
  minLength,
  labelSlot,
  invalid,
  value,
  onChange,
}: PasswordFieldProps) {
  const reactId = useId();
  const inputId = id ?? `${name}-${reactId}`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="flex items-center justify-between text-[12px] font-medium text-white/70"
      >
        <span>{label}</span>
        {labelSlot}
      </label>
      <div
        className={`relative ${invalid ? "auth-field-shake" : ""}`}
        key={invalid ? "invalid" : "valid"}
      >
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/40">
          <Lock className="h-4 w-4" aria-hidden />
        </span>
        <input
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          aria-invalid={invalid || undefined}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={`h-11 w-full rounded-md border bg-[#1c1c1c] pr-10 pl-9 text-[14px] text-white placeholder:text-white/30 transition-colors focus:outline-none focus:ring-2 ${
            invalid
              ? "border-red-400/60 focus:border-red-400/70 focus:ring-red-400/20"
              : "border-white/[0.08] focus:border-[#3ecf8e]/60 focus:ring-[#3ecf8e]/20"
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/30"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
