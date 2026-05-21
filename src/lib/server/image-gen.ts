import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Generates an image from a text prompt using the cx/gpt-5.5-image model via
 * the configured OpenAI-compatible endpoint. The image is saved to
 * public/generated-images/ and the public URL path is returned.
 *
 * NOTE: Generation typically takes ~90 seconds. The function uses a 3-minute
 * timeout to accommodate this latency.
 *
 * Pass `image` (or `images`) to perform image-to-image / edit / reference
 * workflows — the same endpoint accepts a reference image URL alongside the
 * prompt for providers that support it (gpt-5.5-image, FLUX, nanobanana,
 * runwayml, codex, etc.).
 *
 * Pass an `abortSignal` to cancel an in-flight generation. Aborts propagate
 * to both the HTTP request and the SSE stream reader.
 */
export type GenerateImageOptions = {
  prompt: string;
  size?: string;
  /** Single reference image URL for image-to-image workflows. */
  image?: string;
  /** Multiple reference images (style + subject, etc.). Most providers cap at 4. */
  images?: string[];
  /** External AbortSignal — cancels both the request and SSE reader. */
  abortSignal?: AbortSignal;
};

export async function generateImage(opts: GenerateImageOptions): Promise<{ url: string; prompt: string }> {
  const baseUrl = process.env.OPENAI_BASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!baseUrl) {
    throw new Error("OPENAI_BASE_URL environment variable is not set");
  }
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/images/generations`;

  // Compose an AbortSignal that fires on timeout OR external abort. Older
  // runtimes don't have AbortSignal.any, so wire it manually.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("timeout")), 180_000);
  const onExternalAbort = () => controller.abort(opts.abortSignal?.reason);
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) {
      controller.abort(opts.abortSignal.reason);
    } else {
      opts.abortSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  const body: Record<string, unknown> = {
    model: "cx/gpt-5.5-image",
    prompt: opts.prompt,
    n: 1,
    size: opts.size ?? "auto",
    quality: "auto",
    background: "auto",
    image_detail: "high",
    output_format: "png",
  };
  if (opts.image) body.image = opts.image;
  if (opts.images && opts.images.length > 0) body.images = opts.images;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "text/event-stream",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    // We still need the listener until the SSE reader finishes, but the
    // timeout is harmless to leave running until then. Clear it once we know
    // the request itself completed (or threw).
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    opts.abortSignal?.removeEventListener("abort", onExternalAbort);
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `Image generation request failed: HTTP ${res.status}${errorBody ? ` — ${errorBody}` : ""}`,
    );
  }

  let b64: string;
  try {
    b64 = await parseSseStream(res, controller.signal);
  } finally {
    opts.abortSignal?.removeEventListener("abort", onExternalAbort);
  }

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const outDir = join(process.cwd(), "public", "generated-images");

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, filename), Buffer.from(b64, "base64"));

  return { url: `/generated-images/${filename}`, prompt: opts.prompt };
}

/**
 * Reads the SSE response body and returns the base64 image string from the
 * final `event: done` event. All other events (progress, partial_image) are
 * ignored. Honors the supplied AbortSignal.
 */
async function parseSseStream(res: Response, signal?: AbortSignal): Promise<string> {
  if (!res.body) {
    throw new Error("Image generation response has no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => {
    reader.cancel(signal?.reason).catch(() => {});
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      throw new Error("Image generation aborted");
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) {
        throw new Error("Image generation aborted");
      }

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const events = buffer.split("\n\n");
      // Keep the last (potentially incomplete) chunk in the buffer
      buffer = events.pop() ?? "";

      for (const block of events) {
        const result = parseEventBlock(block);
        if (result !== null) {
          reader.cancel().catch(() => {});
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
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
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
