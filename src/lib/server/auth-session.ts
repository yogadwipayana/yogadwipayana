import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/server/api-response";
import { createClient } from "@/utils/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Resolve the current Supabase session from request cookies. Throws an
 * ApiError(401) if there is no user — `fail()` will turn that into the right
 * JSON shape downstream.
 */
export async function requireUser(): Promise<SessionUser> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  return { id: user.id, email: user.email };
}

/**
 * Like `requireUser`, but also hands back the request-scoped Supabase client
 * that resolved the session. Use this when the route goes on to run RLS-scoped
 * queries as that user, so the client isn't constructed (and the cookies
 * re-parsed) twice.
 */
export async function requireUserWithClient(): Promise<{
  user: SessionUser;
  supabase: SupabaseClient;
}> {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  }

  return { user: { id: user.id, email: user.email }, supabase };
}
