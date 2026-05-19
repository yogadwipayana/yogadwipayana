import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { AccountForm } from "./account-form";

export const metadata = {
  title: "Account · Settings",
  description: "View and update your account profile.",
};

export default async function AccountSettingsPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard/settings/account");
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof metadata.display_name === "string" ? metadata.display_name : "";

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <header>
          <h2 className="text-[18px] font-medium text-white">Account</h2>
          <p className="mt-1 text-[13px] text-white/40">
            Your profile information.
          </p>
        </header>

        <section className="rounded-lg border border-white/[0.08] bg-[#171717]">
          <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-5">
            <span
              aria-hidden
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3ecf8e] to-[#24b47e] font-mono text-[18px] font-medium text-[#171717]"
            >
              {(user.email?.[0] ?? "y").toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-white">
                {displayName || user.email || "Anonymous"}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-white/40">
                {user.email}
              </p>
            </div>
          </div>
          <dl className="divide-y divide-white/[0.05] text-[13px]">
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="text-white/45">Email</dt>
              <dd className="font-mono text-white/75">{user.email ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="text-white/45">User ID</dt>
              <dd className="truncate font-mono text-white/55" title={user.id}>
                {user.id.slice(0, 8)}…
              </dd>
            </div>
            <div className="flex items-center justify-between px-5 py-3">
              <dt className="text-white/45">Joined</dt>
              <dd className="text-white/65">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <AccountForm initialDisplayName={displayName} />
      </div>
    </div>
  );
}
