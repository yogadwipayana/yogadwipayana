import { cache } from "react";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";

/**
 * The signed-in Supabase user for the current request, or null. Wrapped in
 * React `cache` so a layout and page rendering in the same request share one
 * auth round trip instead of each calling `getUser()`.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** The display name saved from Settings → Account, or "" when unset. */
export function readDisplayName(user: User): string {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  return typeof metadata.display_name === "string"
    ? metadata.display_name.trim()
    : "";
}
