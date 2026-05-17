import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

/**
 * GET /api/search?q=...&limit=20&offset=0
 *
 * Thin wrapper over the `search_documents` Postgres RPC. RLS handles auth:
 * unauthenticated callers only see rows where user_id is null.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  if (!q) {
    return NextResponse.json({ results: [], total: 0 });
  }

  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("search_documents", {
    q,
    result_limit: limit,
    result_offset: offset,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data ?? [] });
}
