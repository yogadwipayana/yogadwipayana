"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { z } from "zod";

import { recordAudit } from "@/lib/server/audit";
import { createClient } from "@/utils/supabase/server";

export type SettingsActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(80, "Display name must be 80 characters or fewer.");

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(72, "Password must be 72 characters or fewer."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "Passwords do not match.",
  });

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().toLowerCase(),
});

function firstError(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input.";
}

export async function updateDisplayName(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const parsed = displayNameSchema.safeParse(formData.get("displayName"));
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You're not signed in." };
  }

  const { error } = await supabase.auth.updateUser({
    data: { display_name: parsed.data },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard/settings/account");
  return { ok: true, message: "Display name updated." };
}

export async function changePassword(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
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
    return { ok: false, error: "You're not signed in." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, message: "Password updated." };
}

export async function signOutEverywhere() {
  const supabase = createClient(await cookies());
  // Revokes the refresh tokens for every session belonging to the current user
  // (including this one), forcing all devices to sign in again.
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteAccount(
  _prev: SettingsActionResult | null,
  formData: FormData,
): Promise<SettingsActionResult> {
  const parsed = deleteAccountSchema.safeParse({
    confirmEmail: formData.get("confirmEmail"),
  });
  if (!parsed.success) {
    return { ok: false, error: firstError(parsed.error) };
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You're not signed in." };
  }

  if (parsed.data.confirmEmail !== (user.email ?? "").toLowerCase()) {
    return {
      ok: false,
      error: "The email you entered doesn't match your account email.",
    };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return {
      ok: false,
      error:
        "Account deletion isn't configured on this server. Contact support.",
    };
  }

  // Service-role client is required because deleteUser is admin-only. Scoped
  // to this single server-side call — never reuse this client for user data.
  const admin = createServerClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await recordAudit({
    userId: user.id,
    action: "account.delete",
    resourceType: "auth.users",
    resourceId: user.id,
  });

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
