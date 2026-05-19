import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Returns a singleton OpenAI SDK client.
 *
 * Works with any OpenAI-compatible provider (OpenRouter, Groq, Together,
 * Fireworks, vLLM, Ollama, etc.) — set `OPENAI_BASE_URL` to override the
 * default endpoint. The SDK automatically appends `/chat/completions`,
 * `/embeddings`, etc. to the base URL.
 *
 *   OPENAI_BASE_URL=https://openrouter.ai/api/v1
 *   OPENAI_API_KEY=sk-or-v1-...
 *   OPENAI_MODEL=anthropic/claude-3.5-sonnet
 */
export const openai = () => {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  _client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    defaultHeaders: {
      "User-Agent": "Mozilla/5.0",
    },
  });
  return _client;
};

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.5";
