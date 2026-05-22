import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

function safePath(input: string | null): string {
  if (!input || typeof input !== "string") return "/dashboard";
  if (!input.startsWith("/")) return "/dashboard";
  if (input.startsWith("//") || input.startsWith("/\\")) return "/dashboard";
  return input;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safePath(searchParams.get("next"));

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/sign-in";
  redirectTo.searchParams.set("error", "auth-callback-failed");
  return NextResponse.redirect(redirectTo);
}
