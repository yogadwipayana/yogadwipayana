import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { ChangePasswordForm } from "./change-password-form";
import { SignOutEverywhereButton } from "./sign-out-everywhere-button";

export const metadata = {
  title: "Security · Settings",
  description: "Update your password and manage active sessions.",
};

export default async function SecuritySettingsPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard/settings/security");
  }

  const lastSignIn = user.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <header>
          <h2 className="text-[18px] font-medium text-white">Security</h2>
          <p className="mt-1 text-[13px] text-white/40">
            Update your password and revoke other devices.
          </p>
        </header>

        <ChangePasswordForm />

        <section className="rounded-lg border border-white/[0.08] bg-[#171717]">
          <div className="space-y-4 px-5 py-5">
            <div>
              <h3 className="text-[14px] font-medium text-white">
                Active sessions
              </h3>
              <p className="mt-1 text-[12px] text-white/40">
                Sign out of every device and browser, including this one.
                You&apos;ll need to sign back in afterwards.
              </p>
            </div>
            <dl className="space-y-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="text-white/45">This device</dt>
                <dd className="text-white/65">Active</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-white/45">Last sign in</dt>
                <dd className="text-white/65">{lastSignIn}</dd>
              </div>
            </dl>
          </div>
          <div className="flex items-center justify-end border-t border-white/[0.05] bg-white/[0.02] px-5 py-3">
            <SignOutEverywhereButton />
          </div>
        </section>
      </div>
    </div>
  );
}
