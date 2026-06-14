"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isAuthApiError } from "@supabase/supabase-js";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { rateLimit, rateLimitReset } from "@/lib/server/rate-limit";

export type ActionResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      /** Stable code clients can branch on (e.g. show "Resend confirmation"). */
      code?: "email_not_confirmed" | "rate_limited" | "invalid_credentials" | "invalid_input" | "unknown";
    };

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
    agree: z
      .union([z.literal("on"), z.literal("true"), z.boolean()])
      .optional(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  })
  .refine((d) => d.agree === "on" || d.agree === "true" || d.agree === true, {
    path: ["agree"],
    message: "You must agree to the terms to continue.",
  });

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

const forgotSchema = z.object({ email: emailSchema });

const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${proto}://${host}`;
}

async function getClientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  );
}

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

export async function signUp(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
    agree: formData.get("agree") ?? false,
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const ip = await getClientIp();
  const limit = rateLimit({
    key: "sign-up",
    identifier: `${ip}::${parsed.data.email}`,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many sign-up attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const supabase = createClient(await cookies());
  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/dashboard")}`,
    },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function signIn(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const ip = await getClientIp();
  const rlKey = `${ip}::${parsed.data.email}`;
  const limit = rateLimit({
    key: "sign-in",
    identifier: rlKey,
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (isAuthApiError(error) && error.code === "email_not_confirmed") {
      return {
        ok: false,
        code: "email_not_confirmed",
        error:
          "Please confirm your email before signing in. Check your inbox for the confirmation link.",
      };
    }
    return {
      ok: false,
      code: "invalid_credentials",
      error: "Invalid email or password.",
    };
  }

  rateLimitReset("sign-in", rlKey);

  const next = (formData.get("next") as string | null) ?? "/dashboard";
  const safeNext = sanitizeRedirectPath(next);
  revalidatePath("/", "layout");
  redirect(safeNext);
}

/**
 * Restrict post-auth redirects to same-origin path-only URLs. Rejects
 * protocol-relative (`//evil.com/x`), backslash-prefixed, and absolute URLs to
 * prevent open-redirect phishing chains.
 */
function sanitizeRedirectPath(input: string): string {
  if (typeof input !== "string") return "/dashboard";
  if (!input.startsWith("/")) return "/dashboard";
  if (input.startsWith("//") || input.startsWith("/\\")) return "/dashboard";
  // A legitimate single path never contains whitespace or commas. Duplicate
  // `next` params get coerced to "/a, /a", which would 404 — reject those.
  if (/[\s,]/.test(input)) return "/dashboard";
  return input;
}

export async function resendConfirmation(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, code: "invalid_input", error: firstError(parsed.error) };
  }

  const ip = await getClientIp();
  const limit = rateLimit({
    key: "resend-confirmation",
    identifier: `${ip}::${parsed.data.email}`,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return {
      ok: false,
      code: "rate_limited",
      error: `Too many resend attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const supabase = createClient(await cookies());
  const origin = await getOrigin();
  // Errors are intentionally swallowed so we don't leak whether an account exists.
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/dashboard")}`,
    },
  });

  return { ok: true };
}

export async function requestPasswordReset(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const ip = await getClientIp();
  const limit = rateLimit({
    key: "forgot-password",
    identifier: `${ip}::${parsed.data.email}`,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!limit.ok) {
    return {
      ok: false,
      error: `Too many reset requests. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const supabase = createClient(await cookies());
  const origin = await getOrigin();
  // Errors are intentionally swallowed so we don't leak whether an account exists.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });

  return { ok: true };
}

export async function updatePassword(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Your reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = createClient(await cookies());
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
