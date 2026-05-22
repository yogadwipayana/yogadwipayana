import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createPresignedUploadUrl, publicUrl } from "@/lib/s3";
import { fail } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(127),
  size: z.number().int().positive().max(50 * 1024 * 1024), // 50 MB
});

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

/**
 * POST /api/upload
 * Body: { filename, contentType, size }
 * Returns a presigned PUT URL the client uses to upload directly to S3.
 *
 * Auth: only authenticated users. Bytes never touch our server.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await checkRateLimit(
      ratelimits.upload,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "/api/upload",
    );

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { filename, contentType, size } = parsed.data;
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported contentType: ${contentType}` },
        { status: 415 },
      );
    }

    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `u/${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const url = await createPresignedUploadUrl({ key, contentType });

    return NextResponse.json({
      url,
      method: "PUT",
      key,
      publicUrl: publicUrl(key),
      expiresIn: 60,
      size,
    });
  } catch (err) {
    return fail(err);
  }
}
