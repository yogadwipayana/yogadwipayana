import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_MODEL, openai } from "@/lib/openai";
import { ApiError, fail } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  prompt: z.string().min(1).max(8_000),
  system: z.string().max(4_000).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * POST /api/ai — one-shot completion (non-streaming).
 * Used for utility prompts: summarize, extract, classify, etc.
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
    }

    await checkRateLimit(
      ratelimits.ai,
      getRateLimitIdentifier(user.id, getClientIp(request.headers)),
      "/api/ai",
    );

    const json = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { prompt, system, model, temperature } = parsed.data;
    const completion = await openai().chat.completions.create({
      model: model ?? DEFAULT_MODEL,
      temperature: temperature ?? 0.3,
      messages: [
        ...(system ? ([{ role: "system" as const, content: system }]) : []),
        { role: "user" as const, content: prompt },
      ],
    });

    const text = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      text,
      model: completion.model,
      usage: completion.usage,
    });
  } catch (err) {
    return fail(err);
  }
}
