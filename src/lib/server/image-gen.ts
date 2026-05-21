import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generates an image from a text prompt using the cx/gpt-5.4-image model via
 * the configured OpenAI-compatible endpoint. The image is saved to
 * public/generated-images/ and the public URL path is returned.
 *
 * NOTE: Generation typically takes ~90 seconds. The function uses a 3-minute
 * timeout to accommodate this latency.
 */
export async function generateImage(opts: {
  prompt: string;
  size?: string;
}): Promise<{ url: string; prompt: string }> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl) {
    throw new Error("OPENAI_BASE_URL environment variable is not set");
  }
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/images/generations`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Accept": "text/event-stream",
    },
    body: JSON.stringify({
      model: "cx/gpt-5.4-image",
      prompt: opts.prompt,
      n: 1,
      size: opts.size ?? "auto",
      quality: "auto",
      background: "auto",
      image_detail: "high",
      output_format: "png",
    }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `Image generation request failed: HTTP ${res.status}${errorBody ? ` — ${errorBody}` : ""}`,
    );
  }

  const b64 = await parseSseStream(res);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const outDir = join(process.cwd(), "public", "generated-images");

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, filename), Buffer.from(b64, "base64"));

  return { url: `/generated-images/${filename}`, prompt: opts.prompt };
}

/**
 * Reads the SSE response body and returns the base64 image string from the
 * final `event: done` event. All other events (progress, partial_image) are
 * ignored.
 */
async function parseSseStream(res: Response): Promise<string> {
  if (!res.body) {
    throw new Error("Image generation response has no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const events = buffer.split("\n\n");
    // Keep the last (potentially incomplete) chunk in the buffer
    buffer = events.pop() ?? "";

    for (const block of events) {
      const result = parseEventBlock(block);
      if (result !== null) {
        reader.cancel();
        return result;
      }
    }
  }

  // Flush any remaining buffer content
  if (buffer.trim()) {
    const result = parseEventBlock(buffer);
    if (result !== null) {
      return result;
    }
  }

  throw new Error("Image generation did not return a final image");
}

/**
 * Parses a single SSE event block. Returns the base64 string if this is the
 * `done` event, otherwise returns null.
 */
function parseEventBlock(block: string): string | null {
  const lines = block.split("\n");
  let eventName = "";
  let dataLine = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice("data:".length).trim();
    }
  }

  if (eventName !== "done" || !dataLine) {
    return null;
  }

  let parsed: { created?: number; data?: Array<{ b64_json?: string }> };
  try {
    parsed = JSON.parse(dataLine);
  } catch {
    throw new Error(`Failed to parse done event data: ${dataLine.slice(0, 200)}`);
  }

  const b64 = parsed.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("done event did not contain b64_json image data");
  }

  return b64;
}
