import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { aiAdminConfigured, aiHeaders, aiUrl, ensureAiOwner } from "@/lib/server/ai-admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!aiAdminConfigured()) {
    return NextResponse.json(
      { error: "AI router not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const email = user.email;

  const json = await request.json().catch(() => null);
  const rawName = typeof json?.name === "string" ? json.name.trim() : "";
  if (!rawName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    try {
      await ensureAiOwner(email);
    } catch (err) {
      console.error("[ai-keys] owner upsert failed", err);
      return NextResponse.json(
        { error: "AI router upstream error", detail: String(err) },
        { status: 502 },
      );
    }

    const createRes = await fetch(aiUrl("/admin/api-keys"), {
      method: "POST",
      headers: aiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ name: rawName, owner: email }),
    });

    const body = await createRes.json().catch(() => null);

    if (!createRes.ok) {
      console.error("[ai-keys] create failed", createRes.status, body);
      if (createRes.status >= 400 && createRes.status < 500) {
        return NextResponse.json(
          { error: body?.error ?? "Bad request to AI router" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "AI router upstream error", detail: body ?? "" },
        { status: 502 },
      );
    }

    return NextResponse.json(body, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ai-keys] upstream timeout after 25s");
      return NextResponse.json(
        { error: "AI router upstream error", detail: "Request timed out" },
        { status: 502 },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[ai-keys] unexpected error", detail);
    return NextResponse.json(
      { error: "AI router upstream error", detail },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
