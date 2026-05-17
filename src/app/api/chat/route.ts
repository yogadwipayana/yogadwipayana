import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { DEFAULT_MODEL, openai } from "@/lib/openai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});

/**
 * POST /api/chat — streaming SSE-style chat completion.
 * Returns a `text/event-stream` body with the model's deltas.
 */
export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { messages, model, temperature } = parsed.data;

  const stream = await openai().chat.completions.create({
    model: model ?? DEFAULT_MODEL,
    temperature: temperature ?? 0.7,
    stream: true,
    messages,
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
            );
          }
        }
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "stream error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
