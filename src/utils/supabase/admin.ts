import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for SERVER-SIDE BACKGROUND WORK ONLY.
 *
 * Unlike the cookie-scoped client in ./server.ts, this client is not tied to a
 * request's auth context, so it keeps working after the HTTP response has been
 * sent. Use it for fire-and-forget jobs (e.g. background image generation that
 * outlives the client connection).
 *
 * It bypasses Row Level Security, so every query MUST be explicitly scoped to
 * the owning user (e.g. .eq("user_id", userId) / .eq("id", ownedRowId)). Never
 * pass this client untrusted input without scoping.
 */
let _admin: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL not configured",
    );
  }
  _admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _admin;
}
