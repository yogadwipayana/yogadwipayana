import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { presetToSize } from "@/lib/aspect-ratio";
import { generateAndRecord, listGeneratedImages } from "@/lib/server/image-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
// Image generation takes ~90 s; give the route 3 minutes.
export const maxDuration = 180;

/* -------------------------------------------------------------------------- */
/*  Owner gate helper                                                          */
/* -------------------------------------------------------------------------- */

function isOwner(userId: string): boolean {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) return false;
  return userId === ownerId;
}

/* -------------------------------------------------------------------------- */
/*  Default prompts                                                            */
/* -------------------------------------------------------------------------- */

const DEFAULT_PROMPTS: Record<string, string> = {
  avatar:
    "A clean, professional headshot illustration of a developer, soft lighting, neutral background, friendly expression, technical aesthetic, suitable for a personal portfolio site",
  "og-default":
    "A minimal Supabase-inspired hero image, dark background #1c1c1c with subtle green #3ecf8e accents, abstract geometric pattern suggesting code and infrastructure, suitable for social-link previews",
};

function resolvePrompt(target: string, page?: string, override?: string): string {
  if (override && override.trim()) return override.trim();
  if (target === "og-page" && page) {
    const slug = page.replace(/^\//, "") || "home";
    return `A minimal Supabase-inspired Open Graph image for the "${slug}" page of a developer portfolio. Dark background #1c1c1c, subtle green #3ecf8e accents, abstract geometric pattern, page name "${slug}" subtly integrated, suitable for social-link previews`;
  }
  return DEFAULT_PROMPTS[target] ?? DEFAULT_PROMPTS["og-default"];
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

const PostBody = z.object({
  target: z.enum(["avatar", "og-default", "og-page"]),
  page: z.string().optional(),
  prompt: z.string().optional(),
  reference_image_url: z.string().url().optional(),
});

/* -------------------------------------------------------------------------- */
/*  GET — list prior admin generations                                         */
/* -------------------------------------------------------------------------- */

export async function GET() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOwner(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const all = await listGeneratedImages(supabase, user.id, { limit: 30 });
  const images = all.filter((img) => img.source === "admin");
  return NextResponse.json({ images });
}

/* -------------------------------------------------------------------------- */
/*  POST — generate a new image                                                */
/* -------------------------------------------------------------------------- */

export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOwner(user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { target, page, prompt: promptOverride, reference_image_url } = parsed.data;

  // Resolve prompt and size
  const prompt = resolvePrompt(target, page, promptOverride);
  const preset = target === "avatar" ? "square" : "wide";
  const size = presetToSize(preset);

  const row = await generateAndRecord({
    supabase,
    userId: user.id,
    prompt,
    options: {
      prompt,
      size,
      ...(reference_image_url ? { image: reference_image_url } : {}),
    },
    conversationId: null,
    source: "admin",
  });

  return NextResponse.json({ image: row }, { status: 201 });
}
