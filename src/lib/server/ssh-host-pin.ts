import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Trust-On-First-Use SSH host-key pinning.
 *
 * Tencent doesn't expose the SSH host fingerprint, so we record the
 * SHA-256 of the server's public key on the first successful connect and
 * refuse subsequent connects whose key doesn't match. This blocks
 * passive/active MITM between us and the VPS without forcing the user to
 * paste a fingerprint manually.
 *
 * On legitimate reinstall/rebuild the user resets the row from the
 * dashboard (handled in instance reinstall flow) so the next connect
 * re-pins.
 */

export function fingerprintFromKey(key: Buffer): string {
  return createHash("sha256").update(key).digest("base64");
}

/**
 * Build an ssh2 `hostVerifier` callback that enforces TOFU against the
 * `instance.host_fingerprint_sha256` column.
 *
 * Returns `(key, cb) => cb(true|false)` — ssh2's expected signature.
 */
export function makeHostVerifier(args: {
  supabase: SupabaseClient;
  instanceId: string;
  userId: string;
  /** Optional log channel for the rejection reason (server logs only). */
  onReject?: (reason: string) => void;
}): (key: Buffer, cb: (valid: boolean) => void) => void {
  const { supabase, instanceId, userId, onReject } = args;

  return (key, cb) => {
    const observed = fingerprintFromKey(key);

    // Async work in the verifier — kick off, then call cb when settled.
    (async () => {
      const { data, error } = await supabase
        .from("instance")
        .select("host_fingerprint_sha256")
        .eq("id", instanceId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        onReject?.(`db error: ${error.message}`);
        cb(false);
        return;
      }

      const stored =
        (data as { host_fingerprint_sha256: string | null } | null)
          ?.host_fingerprint_sha256 ?? null;

      if (stored && stored !== observed) {
        onReject?.(
          `host fingerprint mismatch (expected ${stored.slice(0, 8)}…, got ${observed.slice(0, 8)}…)`,
        );
        cb(false);
        return;
      }

      if (!stored) {
        // First connect — pin the fingerprint.
        const { error: updErr } = await supabase
          .from("instance")
          .update({ host_fingerprint_sha256: observed })
          .eq("id", instanceId)
          .eq("user_id", userId);
        if (updErr) {
          onReject?.(`pin failed: ${updErr.message}`);
          cb(false);
          return;
        }
      }

      cb(true);
    })().catch((err) => {
      onReject?.(`verifier exception: ${err instanceof Error ? err.message : String(err)}`);
      cb(false);
    });
  };
}

/**
 * Clear the pinned fingerprint for an instance — call this from the
 * dashboard when a user explicitly reinstalls the VPS.
 */
export async function clearHostFingerprint(
  supabase: SupabaseClient,
  userId: string,
  instanceId: string,
): Promise<void> {
  await supabase
    .from("instance")
    .update({ host_fingerprint_sha256: null })
    .eq("id", instanceId)
    .eq("user_id", userId);
}
