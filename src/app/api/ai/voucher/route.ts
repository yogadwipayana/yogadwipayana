import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { aiAdminConfigured, aiHeaders, aiUrl, ensureAiOwner } from "@/lib/server/ai-admin";
import { rateLimit } from "@/lib/server/rate-limit";

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

  const limit = rateLimit({
    key: "voucher-redeem",
    identifier: user.id,
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Too many voucher attempts. Retry after ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const json = await request.json().catch(() => null);
  const code = typeof json?.code === "string" ? json.code.trim() : "";
  if (!code) {
    return NextResponse.json({ error: "Voucher code is required" }, { status: 400 });
  }
  if (code.length > 64) {
    return NextResponse.json({ error: "Invalid voucher code." }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    try {
      await ensureAiOwner(email);
    } catch (err) {
      console.error("[voucher] owner upsert failed", err);
      return NextResponse.json(
        { error: "AI router upstream error" },
        { status: 502 },
      );
    }

    const redeemRes = await fetch(aiUrl("/admin/voucher"), {
      method: "POST",
      headers: aiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ code, email }),
    });

    const body = await redeemRes.json().catch(() => null);

    if (!redeemRes.ok) {
      console.error("[voucher] redeem failed", redeemRes.status);
      if (redeemRes.status >= 400 && redeemRes.status < 500) {
        return NextResponse.json(
          { error: body?.error ?? "Bad request to AI router" },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: "AI router upstream error" },
        { status: 502 },
      );
    }

    return NextResponse.json(body, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[voucher] upstream timeout after 25s");
      return NextResponse.json(
        { error: "AI router upstream error", detail: "Request timed out" },
        { status: 502 },
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[voucher] unexpected error", detail);
    return NextResponse.json(
      { error: "AI router upstream error" },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
