import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getObjectBytes } from "@/lib/r2";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/files/<key>
 * Streams private objects back from Cloudflare R2 to authenticated users.
 * The catch-all <key> can span multiple path segments (e.g.
 * /api/files/u/<userid>/123-abc.png). Auth is required to keep the
 * bucket private and gated.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key: segments } = await params;
  if (!segments || segments.length === 0 || segments.some((s) => s === "..")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const key = segments.join("/");
  if (!key) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const { body, contentType } = await getObjectBytes(key);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
