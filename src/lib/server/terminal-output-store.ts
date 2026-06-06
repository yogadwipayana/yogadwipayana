/**
 * In-memory store for captured terminal command output.
 *
 * After the user approves a `terminal_run` command, the client injects it into
 * the SSH terminal, captures the command's stdout/stderr between sentinel
 * markers, then POSTs the captured text back. The `terminal_run` tool blocks
 * here until that output arrives so the AI can read the actual result.
 */

export type TerminalOutput = {
  output: string;
  exitCode: number | null;
  truncated?: boolean;
};

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes — matches a long-running command budget

type Pending = {
  resolve: (output: TerminalOutput | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

const waiters = new Map<string, Pending>();
// Output that arrived before the tool started waiting (resolve/wait race).
const stash = new Map<string, TerminalOutput>();

/**
 * Wait for the captured output of an approved command.
 * Resolves with the output, or `null` on timeout / client disconnect.
 */
export function waitForTerminalOutput(
  callId: string,
  abortSignal?: AbortSignal,
): Promise<TerminalOutput | null> {
  // Output already arrived — return it immediately.
  const early = stash.get(callId);
  if (early) {
    stash.delete(callId);
    return Promise.resolve(early);
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      waiters.delete(callId);
      resolve(null);
    }, TIMEOUT_MS);

    waiters.set(callId, { resolve, timer });

    abortSignal?.addEventListener(
      "abort",
      () => {
        const pending = waiters.get(callId);
        if (pending) {
          clearTimeout(pending.timer);
          waiters.delete(callId);
          resolve(null);
        }
      },
      { once: true },
    );
  });
}

/**
 * Deliver captured output for `callId`. If a waiter is registered it resolves
 * immediately; otherwise the output is stashed briefly for an imminent waiter.
 */
export function resolveTerminalOutput(
  callId: string,
  output: TerminalOutput,
): void {
  const pending = waiters.get(callId);
  if (pending) {
    clearTimeout(pending.timer);
    waiters.delete(callId);
    pending.resolve(output);
    return;
  }

  // No waiter yet — stash so a waiter registered shortly after still sees it.
  stash.set(callId, output);
  setTimeout(() => stash.delete(callId), 30_000);
}
