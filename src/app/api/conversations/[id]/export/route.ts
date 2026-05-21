import { cookies } from "next/headers";

import {
  getConversation,
  getMessages,
} from "@/lib/server/chat-service";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function slugify(title: string, fallback: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id } = await params;
  const conversation = await getConversation(supabase, id, user.id);
  if (!conversation) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const messages = await getMessages(supabase, id, user.id);

  const updatedAt = new Date(conversation.updated_at).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [
    `# ${conversation.title}`,
    "",
    `Model: ${conversation.model} · Updated: ${updatedAt}`,
    "",
  ];

  for (const msg of messages) {
    if (msg.role === "system") continue;
    const heading = msg.role === "user" ? "## You" : "## Assistant";
    lines.push(heading, "", msg.content, "");
  }

  const markdown = lines.join("\n");
  const filename = slugify(conversation.title, id.slice(0, 8));

  return new Response(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.md"`,
    },
  });
}
