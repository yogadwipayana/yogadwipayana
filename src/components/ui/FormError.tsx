"use client";

import { AlertCircle } from "lucide-react";

type FormErrorProps = {
  /** Pass a unique value (the message itself works) so the animation re-fires when the message changes. */
  message: string | null | undefined;
};

export function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <p
      key={message}
      role="alert"
      aria-live="polite"
      className="auth-error-in flex items-start gap-1.5 text-[12px] leading-snug text-red-400"
    >
      <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}
