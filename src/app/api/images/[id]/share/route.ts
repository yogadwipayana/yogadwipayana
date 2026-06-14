import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createPresignedDownloadUrl, keyFromProxyUrl } from "@/lib/r2";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const ParamId = z.string().uuid();

type ImageShareRow = { url: string | null; user_id: string };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!ParamId.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("generated_image")
    .select("url,user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle<ImageShareRow>();
  if (error) {
    console.error("[/api/images/:id/share] lookup failed:", error);
    return NextResponse.json({ error: "Failed to load image" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!row.url) {
    return NextResponse.json({ error: "Image not ready" }, { status: 409 });
  }

  const key = keyFromProxyUrl(row.url);
  if (!key) {
    return NextResponse.json(
      { error: "This image cannot be shared (external source)" },
      { status: 422 },
    );
  }

  try {
    const url = await createPresignedDownloadUrl({ key, expiresIn: 3600 });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[/api/images/:id/share] presign failed:", err);
    return NextResponse.json(
      { error: "Failed to create share link" },
      { status: 500 },
    );
  }
}
