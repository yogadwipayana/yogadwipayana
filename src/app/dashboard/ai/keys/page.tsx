import { Key } from "lucide-react";
import { cookies } from "next/headers";

import { createClient } from "@/utils/supabase/server";
import { aiDb } from "@/lib/db/ai";
import CreateKeyModal from "./CreateKeyModal";
import DeleteKeyButton from "./DeleteKeyButton";
import EditKeyModal from "./EditKeyModal";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })
    .format(new Date(value));
}

function maskKey(raw: string): string {
  return raw.length >= 4 ? `sk-...${raw.slice(-4)}` : "sk-...";
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-[#171717]">{children}</div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function AiKeysPage() {
  /* ── Auth ── */
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  /* ── DB query — only fetch keys owned by the logged-in user ── */
  const keys = email
    ? await aiDb.apiKeys.findMany({ where: { owner: email }, orderBy: { createdAt: "desc" } })
    : [];

  const isLoggedIn = email !== null;

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-medium text-white">API Keys</h2>
            <p className="mt-1 text-[13px] text-white/40">
              Manage your personal API keys for accessing the AI router.
            </p>
          </div>
          {isLoggedIn && <CreateKeyModal />}
        </div>

        {/* Sign-in banner */}
        {!isLoggedIn && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
            <p className="text-[12px] text-white/40">Sign in to see your API keys.</p>
          </div>
        )}

        {/* Keys list */}
        {keys.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Key className="h-8 w-8 text-white/10" />
              <p className="text-[13px] text-white/30">
                {isLoggedIn
                  ? "No API keys yet. Use “New key” above to create one."
                  : "Sign in to see your API keys."}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-[#171717] px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium text-white">
                      {key.name ?? "Untitled key"}
                    </span>
                    {key.isActive === 0 && (
                      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-white/35">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-white/40">
                    <span className="font-mono">{maskKey(key.key)}</span>
                    <span className="text-white/20">·</span>
                    <span>Added {formatDate(key.createdAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <EditKeyModal
                    keyId={key.id}
                    initialName={key.name ?? ""}
                    initialIsActive={key.isActive === 1}
                  />
                  <DeleteKeyButton keyId={key.id} keyName={key.name ?? "Untitled key"} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <Card>
          <div className="px-5 py-4 text-[12px] text-white/40 leading-relaxed">
            All keys use <span className="text-amber-300">Pay as you go</span> billing — requests are charged against your credit balance at standard model rates.
          </div>
        </Card>
      </div>
    </div>
  );
}
