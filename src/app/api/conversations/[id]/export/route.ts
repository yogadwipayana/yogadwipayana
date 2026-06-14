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

function toolLabel(name: string): string {
  const map: Record<string, string> = {
    web_search: "Web search",
    web_fetch: "Fetched a page",
    image_generate: "Generated an image",
    image_edit: "Edited an image",
    generate_docx: "Generated a document",
    open_terminal: "Opened a terminal",
    terminal_run: "Ran a command",
    ask_user: "Asked a question",
  };
  return map[name] ?? name.replace(/_/g, " ");
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
    lines.push(heading, "");

    // Tool calls the assistant ran during this turn. Generated-image URLs are
    // already embedded in `content` as markdown, but the tool log gives a
    // labeled summary plus any web sources gathered.
    const toolEvents = (msg.tool_events ?? []).filter((e) => e.status === "done");
    if (toolEvents.length > 0) {
      lines.push("> **Tools used**");
      for (const evt of toolEvents) {
        lines.push(`> - ${toolLabel(evt.name)}`);
        if (evt.name === "web_search" && evt.result) {
          const r = evt.result as { results?: Array<{ title?: string; url?: string }> };
          for (const item of r.results ?? []) {
            if (item.url) lines.push(`>   - [${item.title ?? item.url}](${item.url})`);
          }
        }
        if (evt.name === "web_fetch" && evt.result) {
          const r = evt.result as { url?: string; title?: string };
          if (r.url) lines.push(`>   - [${r.title ?? r.url}](${r.url})`);
        }
      }
      lines.push("");
    }

    lines.push(msg.content, "");

    // Follow-up suggestions generated after the assistant turn.
    const followUps = msg.follow_ups ?? [];
    if (followUps.length > 0) {
      lines.push("**Follow-ups**", "");
      for (const q of followUps) lines.push(`- ${q}`);
      lines.push("");
    }
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
