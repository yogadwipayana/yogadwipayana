import { PostHog } from "posthog-node";

let _client: PostHog | null = null;

/**
 * Returns a singleton posthog-node client, or null when no project key is set.
 *
 * Ingestion uses the project API key (phc_…), the same key the browser client
 * uses — NOT a personal key (phx_…), which only works for the query/management
 * API and silently drops captured events. When the key is absent the client is
 * a no-op so capture calls stay safe in local/dev or unconfigured environments.
 */
const posthog = (): PostHog | null => {
  if (_client) return _client;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  _client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Flush immediately: route handlers are short-lived, so batching risks
    // dropping events before the process is reused.
    flushAt: 1,
    flushInterval: 0,
  });
  return _client;
};

type AiGenerationInput = {
  /** Authenticated user id — attributes usage to the person. */
  userId: string;
  /** Which tool the request came from. */
  surface: "router" | "chat";
  /** Model identifier as resolved by the provider (e.g. gpt-5.5). */
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Wall-clock latency in seconds, if known. */
  latencySeconds?: number;
  /** Number of tool calls executed during the turn (chat surface). */
  toolCalls?: number;
  /** Groups related AI events into a trace (e.g. conversation id). */
  traceId?: string;
};

/**
 * Emits a PostHog `$ai_generation` event so usage shows up in LLM analytics,
 * broken down by model and by `surface`. Best-effort: never throws.
 *
 * Cost is not sent explicitly: PostHog auto-computes `$ai_total_cost_usd` from
 * `$ai_model` + token counts against its pricing table (verified for gpt-5.5
 * and claude-* models). Models with no pricing entry simply get no auto cost;
 * model + token breakdowns populate regardless.
 */
export async function captureAiGeneration(input: AiGenerationInput): Promise<void> {
  const client = posthog();
  if (!client) return;
  try {
    client.capture({
      distinctId: input.userId,
      event: "$ai_generation",
      properties: {
        $ai_model: input.model,
        $ai_provider: "openai-compatible",
        $ai_input_tokens: input.promptTokens,
        $ai_output_tokens: input.completionTokens,
        $ai_total_tokens: input.totalTokens,
        ...(input.latencySeconds !== undefined
          ? { $ai_latency: input.latencySeconds }
          : {}),
        ...(input.traceId ? { $ai_trace_id: input.traceId } : {}),
        ...(input.toolCalls !== undefined ? { tool_calls: input.toolCalls } : {}),
        surface: input.surface,
      },
    });
    await client.flush();
  } catch {
    // Telemetry is best-effort; never break the request.
  }
}

/**
 * Captures an arbitrary product event attributed to the logged-in user.
 * Best-effort: never throws.
 */
export async function captureEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const client = posthog();
  if (!client) return;
  try {
    client.capture({ distinctId: userId, event, properties });
    await client.flush();
  } catch {
    // Telemetry is best-effort; never break the request.
  }
}

/**
 * Associates a PostHog person with the logged-in user and sets person
 * properties. `signup_date` is written with `$set_once` so it records the
 * first-seen signup and is never overwritten on later logins — this powers
 * "account age" and "new users" reporting. Best-effort: never throws.
 */
export async function identifyUser(
  userId: string,
  props: { email?: string; signupDate?: string },
): Promise<void> {
  const client = posthog();
  if (!client) return;
  try {
    const set: Record<string, unknown> = {};
    if (props.email) set.email = props.email;
    const setOnce: Record<string, unknown> = {};
    if (props.signupDate) setOnce.signup_date = props.signupDate;
    client.identify({
      distinctId: userId,
      properties: { $set: set, $set_once: setOnce },
    });
    await client.flush();
  } catch {
    // Telemetry is best-effort; never break the request.
  }
}
