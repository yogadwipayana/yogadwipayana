/**
 * In-memory store for terminal command approvals.
 *
 * When the AI calls `terminal_run`, the tool execution blocks here waiting
 * for the user to click "Run" or "Deny" in the chat UI. The approval endpoint
 * resolves the pending Promise, unblocking the SSE stream.
 */

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type Pending = {
  resolve: (approved: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
};

const store = new Map<string, Pending>();

/**
 * Register a pending approval for `callId`.
 * Returns a Promise that resolves to `true` (approved) or `false` (denied / timed-out).
 * Auto-denies when `abortSignal` fires (client disconnected).
 */
export function requestApproval(
  callId: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      store.delete(callId);
      resolve(false);
    }, TIMEOUT_MS);

    store.set(callId, { resolve, timer });

    abortSignal?.addEventListener(
      "abort",
      () => {
        const pending = store.get(callId);
        if (pending) {
          clearTimeout(pending.timer);
          store.delete(callId);
          resolve(false);
        }
      },
      { once: true },
    );
  });
}

/**
 * Resolve a pending approval. Returns `true` if found and resolved,
 * `false` if there was no pending entry for `callId`.
 */
export function resolveApproval(callId: string, approved: boolean): boolean {
  const pending = store.get(callId);
  if (!pending) return false;
  clearTimeout(pending.timer);
  store.delete(callId);
  pending.resolve(approved);
  return true;
}
