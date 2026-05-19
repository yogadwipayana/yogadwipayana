import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { openai } from "@/lib/openai";
import {
  appendMessage,
  deriveTitle,
  getConversation,
  getMessages,
  updateConversation,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  content: z.string().min(1).max(20_000),
});

const SYSTEM_PROMPT = `You are a helpful, expert engineering assistant.

# Formatting rules (very important)

Write rich, well-structured Markdown. Treat your replies like good technical documentation — not a chatbot transcript.

- Use **headings** (\`##\` for major sections, \`###\` for subsections) to organize multi-part answers. Skip headings for one-off short answers.
- Use **bullet lists** for enumerations and **numbered lists** only for ordered steps.
- Use **bold** for key terms, file names, env vars, and command names. Use _italic_ sparingly for emphasis.
- Use \`inline code\` for short identifiers, file paths, env var names, flags, and command fragments. Inline code, not a fenced block, for things like \`POSTGRES_PASSWORD\` or \`./run.sh\`.
- Use fenced code blocks (with the correct language tag — \`bash\`, \`ts\`, \`tsx\`, \`js\`, \`json\`, \`yaml\`, \`sql\`, \`go\`, \`py\`, \`tf\`, etc.) for **multi-line code**, full commands, config files, and snippets. Never put a single short token in its own fenced block — use inline code.
- Group related shell commands into one fenced block with comments rather than many one-line blocks.
- For comparisons or configs, use **tables** when it helps readability.
- Use **blockquotes** (\`>\`) for callouts: tips, warnings, gotchas, and "why this matters" notes.
- Link external resources as proper Markdown links: \`[Docker docs](https://docs.docker.com)\`.
- Keep prose tight. Lead with the answer, then explain. No filler like "Sure!" or "Of course!".
- When walking through a setup or migration, end with a short **Verify** section telling the user how to confirm it worked.

# Response shape

For a non-trivial how-to: start with a one-sentence summary, then numbered steps with code, then a Verify or Notes section.
For a short factual question: answer in one or two sentences, no headings.
For code review or debugging: lead with the diagnosis, then the fix, then prevention.

Match the user's language. If the user writes in Bahasa Indonesia, reply in Bahasa Indonesia.`;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let conversation, priorMessages, stream;
  try {
    conversation = await getConversation(supabase, conversationId, user.id);
    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    priorMessages = await getMessages(supabase, conversationId, user.id);

    await appendMessage(supabase, {
      conversationId,
      userId: user.id,
      role: "user",
      content: parsed.data.content,
    });

    if (priorMessages.length === 0) {
      await updateConversation(supabase, conversationId, user.id, {
        title: deriveTitle(parsed.data.content),
      });
    }

    const messagesForModel = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...priorMessages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: parsed.data.content },
    ];

    stream = await openai().chat.completions.create({
      model: conversation.model,
      temperature: 0.7,
      stream: true,
      messages: messagesForModel,
    });
  } catch (err) {
    console.error("[/api/conversations/[id]/messages] setup failed:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const encoder = new TextEncoder();
  let assistantText = "";

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            assistantText += delta;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`),
            );
          }
        }

        if (assistantText.length > 0) {
          await appendMessage(supabase, {
            conversationId,
            userId: user.id,
            role: "assistant",
            content: assistantText,
          });
        } else {
          // Bump updated_at even if the model returned nothing so the
          // conversation moves to the top of the list.
          await updateConversation(supabase, conversationId, user.id, {});
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
