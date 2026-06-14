import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getObjectBytes, keyFromProxyUrl } from "@/lib/r2";
import { DEFAULT_MODEL, openai } from "@/lib/openai";
import { fail } from "@/lib/server/api-response";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitIdentifier,
  ratelimits,
} from "@/lib/server/rate-limit";
import { validatePublicHttpUrl } from "@/lib/server/safe-fetch";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PostBody = z
  .object({
    prompt: z.string().min(1).max(4_000).optional(),
    image_url: z.string().min(1).max(2_048).optional(),
  })
  .refine((data) => Boolean(data.prompt) || Boolean(data.image_url), {
    message: "Provide a prompt, an image_url, or both",
  });

const SYSTEM_PROMPT = `You are a prompt engineer for a text-to-image model. Rewrite the user's short idea into a single vivid, detailed image-generation prompt.

Rules:
- Add concrete detail about subject, setting, lighting, composition, mood, and style.
- Keep the user's original intent and any named subjects intact.
- Write one cohesive paragraph, no lists, no preamble, no quotes.
- Do not exceed 600 characters.
- Output only the rewritten prompt — nothing else.`;

const VISION_SYSTEM_PROMPT = `You are a prompt engineer for a text-to-image model. Study the provided image and write a single vivid, detailed image-generation prompt that would recreate it.

Rules:
- Describe subject, setting, lighting, composition, color, mood, and style as seen in the image.
- If the user also provides a text instruction, treat it as guidance and steer the prompt accordingly while staying faithful to the image.
- Write one cohesive paragraph, no lists, no preamble, no quotes.
- Do not exceed 600 characters.
- Output only the prompt — nothing else.`;

/**
 * Resolve an incoming reference image to a URL the model can read: our own
 * R2-backed proxy URLs become base64 data URLs (the model can't fetch our
 * private, auth-gated proxy), everything else goes through the SSRF guard.
 */
async function resolveImage(
  raw: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ownKey = keyFromProxyUrl(raw);
  if (ownKey) {
    try {
      const { body, contentType } = await getObjectBytes(ownKey);
      return {
        ok: true,
        url: `data:${contentType ?? "image/png"};base64,${body.toString("base64")}`,
      };
    } catch {
      return { ok: false, error: "Reference image not found" };
    }
  }
  const validation = await validatePublicHttpUrl(raw);
  if (!validation.ok) {
    return { ok: false, error: `image_url rejected: ${validation.error}` };
  }
  return { ok: true, url: raw };
}

export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { prompt, image_url } = parsed.data;

  let resolvedImage: string | undefined;
  if (image_url) {
    const result = await resolveImage(image_url);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    resolvedImage = result.url;
  }

  try {
    const id = getRateLimitIdentifier(user.id, getClientIp(request.headers));
    await checkRateLimit(ratelimits.imageEnhance, id, "prompt enhance");
  } catch (err) {
    return fail(err);
  }

  try {
    const messages: Parameters<
      ReturnType<typeof openai>["chat"]["completions"]["create"]
    >[0]["messages"] = resolvedImage
      ? [
          { role: "system", content: VISION_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
                  ? `Use this as guidance: ${prompt}`
                  : "Describe this image as a generation prompt.",
              },
              { type: "image_url", image_url: { url: resolvedImage } },
            ],
          },
        ]
      : [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt! },
        ];

    const completion = await openai().chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      temperature: 0.8,
      max_tokens: 400,
    });

    const enhanced = completion.choices[0]?.message?.content?.trim();
    if (!enhanced) {
      return NextResponse.json(
        { error: "No enhancement returned" },
        { status: 502 },
      );
    }
    return NextResponse.json({ prompt: enhanced.slice(0, 4_000) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enhance failed";
    console.error("[/api/images/enhance] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
