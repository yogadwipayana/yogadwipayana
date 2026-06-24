import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { ensureAiOwner } from "@/lib/server/ai-admin";
import { captureEvent, identifyUser } from "@/lib/server/posthog";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";

  if (token_hash && type) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // Recovery keeps the session so /reset-password can call updateUser.
      if (type === "recovery") {
        redirectTo.pathname = "/reset-password";
        return NextResponse.redirect(redirectTo);
      }

      // Signup: provision the account, then sign out so the user lands on a
      // "sign in now" page instead of being dropped straight into the dashboard.
      // verifyOtp works cross-device, so the link can be opened anywhere.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        // Best-effort: AI-router downtime must not block account activation —
        // a later API-key creation will retry the same idempotent upsert.
        try {
          await ensureAiOwner(user.email);
        } catch (err) {
          console.error("[auth/confirm] ensureAiOwner failed", err);
        }
        // signup_date is written $set_once so account-age reporting reflects
        // first signup; both calls are best-effort and never throw.
        await identifyUser(user.id, {
          email: user.email,
          signupDate: user.created_at ?? undefined,
        });
        await captureEvent(user.id, "user signed up", {
          email_domain: user.email.split("@")[1] ?? null,
        });
      }

      await supabase.auth.signOut({ scope: "local" });

      redirectTo.pathname = "/confirmed";
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/sign-in";
  redirectTo.search = "";
  redirectTo.searchParams.set("error", "auth-callback-failed");
  return NextResponse.redirect(redirectTo);
}
