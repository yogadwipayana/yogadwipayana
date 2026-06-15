import { type NextRequest } from "next/server";

import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Session refresh only. Returns the response carrying refreshed auth cookies.
  // Authorization stays gated per-layout via getUser() + redirect.
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - image files (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
