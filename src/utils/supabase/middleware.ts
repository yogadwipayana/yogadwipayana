import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Refreshes the Supabase auth session and propagates any rotated auth cookies
 * onto the outgoing response. This is session refresh ONLY — route protection
 * stays gated per-layout via getUser() + redirect.
 *
 * Returns the response that carries the refreshed cookies. The caller MUST
 * return this response so the new cookies reach the browser.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: Do NOT run code between createServerClient and getUser().
  // Refresh the session so rotated tokens are written back to cookies.
  // Do NOT add redirect/route-protection logic here — auth is gated per-layout.
  await supabase.auth.getUser();

  return supabaseResponse;
}
