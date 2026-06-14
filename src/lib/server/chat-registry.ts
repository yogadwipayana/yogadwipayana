/**
 * In-process registry of active chat generations.
 *
 * A generation is owned by the server process, NOT by the HTTP request that
 * started it. This is what lets a completion keep running (and persist to the
 * DB) after the client disconnects — closing a tab, refreshing, or navigating
 * away no longer kills it. Clients attach and re-attach as subscribers; the
 * generation only ends when the model finishes or someone calls `stop()`.
 *
 * Safe because `server.mjs` runs a single long-lived Node process. If this ever
 * moves to multi-instance/serverless, this module-level Map must be replaced by
 * a shared buffer (e.g. Redis streams) keyed the same way.
 */

/** A single SSE payload object (the thing the stream `send()`s as `data:`). */
export type Frame = Record<string, unknown> | { __done: true };

export type FrameListener = (frame: Frame) => void;

export type Generation = {
  conversationId: string;
  /** Every frame emitted so far, replayed in order to late subscribers. */
  buffer: Frame[];
  /** True once the runner has finished (success, error, abort, or budget). */
  done: boolean;
  /** Resolves when the generation finishes (after its final persist). */
  readonly whenDone: Promise<void>;
  /** Aborts the underlying model loop. Tripped only by an explicit stop(). */
  readonly signal: AbortSignal;
  subscribe(listener: FrameListener): () => void;
  /** Append a frame: buffer it and fan out to current subscribers. */
  push(frame: Frame): void;
  /** Mark finished, notify subscribers, and schedule cleanup. */
  finish(): void;
  /** Explicit user-initiated stop. */
  stop(): void;
};

// Keyed by conversationId: at most one active generation per conversation.
const _generations = new Map<string, Generation>();

// How long a finished generation lingers so a reconnecting client can still
// replay the tail (final text + `saved` id) before it's evicted.
const DONE_GRACE_MS = 30_000;

/** Returns the active (or recently-finished, still-buffered) generation, if any. */
export function getGeneration(conversationId: string): Generation | undefined {
  return _generations.get(conversationId);
}

/**
 * Start a generation for a conversation, or return the existing one if a
 * generation is already in flight (start-once guard — protects against a double
 * POST or a retry racing the original).
 *
 * `runner` receives `push` (emit a frame) and `signal` (abort on explicit
 * stop). It should resolve when the generation is fully done and persisted.
 * `finish()` is called automatically once the runner settles.
 */
export function startGeneration(
  conversationId: string,
  runner: (push: (frame: Frame) => void, signal: AbortSignal) => Promise<void>,
): Generation {
  const existing = _generations.get(conversationId);
  if (existing && !existing.done) return existing;

  const controller = new AbortController();
  const listeners = new Set<FrameListener>();
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  let resolveDone!: () => void;
  const whenDone = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const gen: Generation = {
    conversationId,
    buffer: [],
    done: false,
    whenDone,
    signal: controller.signal,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push(frame) {
      if (gen.done) return;
      gen.buffer.push(frame);
      for (const fn of listeners) {
        try {
          fn(frame);
        } catch {
          // A broken subscriber must never break the generation.
        }
      }
    },
    finish() {
      if (gen.done) return;
      gen.done = true;
      resolveDone();
      const sentinel: Frame = { __done: true };
      gen.buffer.push(sentinel);
      for (const fn of listeners) {
        try {
          fn(sentinel);
        } catch {}
      }
      // Evict after a grace window so late reconnects can replay the tail.
      cleanupTimer = setTimeout(() => {
        if (_generations.get(conversationId) === gen) {
          _generations.delete(conversationId);
        }
      }, DONE_GRACE_MS);
      // Don't keep the event loop alive solely for cleanup.
      cleanupTimer.unref?.();
    },
    stop() {
      controller.abort();
    },
  };

  _generations.set(conversationId, gen);

  // Drive the runner. Any throw still finishes the generation so subscribers
  // are released and the slot is freed.
  void (async () => {
    try {
      await runner(gen.push, controller.signal);
    } catch {
      // The runner is expected to surface its own error frames; swallow here.
    } finally {
      gen.finish();
    }
  })();

  return gen;
}

/** Explicitly stop an in-flight generation. No-op if none/already done. */
export function stopGeneration(conversationId: string): boolean {
  const gen = _generations.get(conversationId);
  if (!gen || gen.done) return false;
  gen.stop();
  return true;
}

/**
 * Abort any in-flight generation for a conversation and wait until it has fully
 * settled (its partial assistant turn persisted). Used by edit/regenerate: they
 * mutate conversation history, so a stale generation must be torn down — and its
 * write to the DB completed — BEFORE the history is truncated and a fresh
 * generation starts. Otherwise the old runner could persist a stale assistant
 * message after the truncate, corrupting the branch. Resolves immediately if
 * nothing is running.
 */
export async function stopAndWait(conversationId: string): Promise<void> {
  const gen = _generations.get(conversationId);
  if (!gen || gen.done) return;
  gen.stop();
  await gen.whenDone;
}
