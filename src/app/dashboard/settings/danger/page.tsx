import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { DeleteAccountCard } from "./delete-account-card";

export const metadata = {
  title: "Danger zone · Settings",
  description: "Permanently delete your account.",
};

export default async function DangerSettingsPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in?next=/dashboard/settings/danger");
  }

  return (
    <div className="pb-12 text-white">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <header>
          <h2 className="text-[18px] font-medium text-white">Danger zone</h2>
          <p className="mt-1 text-[13px] text-white/40">
            Irreversible actions. Take a moment before continuing.
          </p>
        </header>

        <DeleteAccountCard email={user.email ?? ""} />
      </div>
    </div>
  );
}
