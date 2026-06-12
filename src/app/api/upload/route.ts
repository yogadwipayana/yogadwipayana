import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { fail } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  // Documents — text extracted server-side via document-parse.ts
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // legacy .xls
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // legacy .ppt
  "text/csv",
  "text/plain",
  "text/markdown",
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * POST /api/upload  (multipart/form-data, field: "file")
 * Saves the file to public/uploads/ and returns its public URL.
 * No external storage required — mirrors how generated images are stored.
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

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 50 MB)" },
        { status: 413 },
      );
    }

    const ext = extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".png");
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const outDir = join(process.cwd(), "public", "uploads");

    await mkdir(outDir, { recursive: true });
    await writeFile(join(outDir, filename), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ publicUrl: `/uploads/${filename}` });
  } catch (err) {
    return fail(err);
  }
}
