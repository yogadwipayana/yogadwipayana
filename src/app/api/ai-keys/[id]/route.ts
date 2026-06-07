import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { aiDb } from "@/lib/db/ai";
import { createClient } from "@/utils/supabase/server";
import { aiAdminConfigured, aiHeaders, aiUrl } from "@/lib/server/ai-admin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const key = await aiDb.apiKeys
    .findUnique({ where: { id }, select: { id: true, owner: true } })
    .catch(() => null);

  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  if (key.owner !== email) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if ("name" in raw) {
    if (typeof raw.name !== "string") {
      return NextResponse.json({ error: "Name must be a string" }, { status: 400 });
    }
    const trimmed = raw.name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    patch.name = trimmed;
  }

  if ("isActive" in raw) {
    if (typeof raw.isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });
    }
    patch.isActive = raw.isActive;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes to apply" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstreamRes = await fetch(aiUrl(`/admin/api-keys/${id}`), {
      method: "PATCH",
      headers: aiHeaders(),
      body: JSON.stringify(patch),
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      const detail = await upstreamRes.text().catch(() => "");
      console.error("[ai-keys patch] upstream error", upstreamRes.status, detail);
      return NextResponse.json(
        { error: "AI router upstream error", detail },
        { status: 502 },
      );
    }

    const text = await upstreamRes.text().catch(() => "");
    try {
      return NextResponse.json(JSON.parse(text));
    } catch {
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ai-keys patch] upstream timeout after 25s");
      return NextResponse.json(
        { error: "AI router upstream error", detail: "Request timed out" },
        { status: 502 },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[ai-keys patch] unexpected error", detail);
    return NextResponse.json(
      { error: "AI router upstream error", detail },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  // Ownership check — query DB directly to avoid an extra upstream round-trip.
  // Return 404 for both true-not-found and ownership-mismatch so we don't
  // reveal the existence of keys belonging to other users.
  const key = await aiDb.apiKeys
    .findUnique({ where: { id }, select: { id: true, owner: true } })
    .catch(() => null);

  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }
  if (key.owner !== email) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const upstreamRes = await fetch(aiUrl(`/admin/api-keys/${id}`), {
      method: "DELETE",
      headers: aiHeaders(),
      signal: controller.signal,
    });

    if (!upstreamRes.ok) {
      const detail = await upstreamRes.text().catch(() => "");
      console.error("[ai-keys delete] upstream error", upstreamRes.status, detail);
      return NextResponse.json(
        { error: "AI router upstream error", detail },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[ai-keys delete] upstream timeout after 25s");
      return NextResponse.json(
        { error: "AI router upstream error", detail: "Request timed out" },
        { status: 502 },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[ai-keys delete] unexpected error", detail);
    return NextResponse.json(
      { error: "AI router upstream error", detail },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
