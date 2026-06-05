import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { aiDb } from "@/lib/db/ai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

function aiHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.ADMIN_AI_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function aiUrl(path: string): string {
  const base = (process.env.AI_BASE_URL ?? "").replace(/\/v1\/?$/, "");
  return `${base}/v1${path}`;
}

export async function POST(request: Request) {
  const aiBaseUrl = process.env.AI_BASE_URL;
  const adminKey = process.env.ADMIN_AI_API_KEY;
  if (!aiBaseUrl || !adminKey) {
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

  // Check ownership via direct DB read instead of an upstream round-trip —
  // upstream POST /admin/api-keys rejects unknown owners with 400.
  const existingOwner = await aiDb.ownerUsers
    .findUnique({ where: { email }, select: { email: true } })
    .catch(() => null);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    if (!existingOwner) {
      const upsertRes = await fetch(aiUrl("/admin/users"), {
        method: "POST",
        headers: aiHeaders(),
        signal: controller.signal,
        body: JSON.stringify({ email, budgetUsd: 0, isActive: true }),
      });
      if (!upsertRes.ok) {
        const detail = await upsertRes.text().catch(() => "");
        console.error("[ai-keys] owner upsert failed", upsertRes.status, detail);
        return NextResponse.json(
          { error: "AI router upstream error", detail },
          { status: 502 },
        );
      }
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
