import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";
import { listUserInstances } from "@/lib/server/dashboard-service";
import { SshTerminalView } from "./view";

export const metadata: Metadata = {
  title: "SSH Terminal · Dashboard",
  description: "Open an interactive SSH terminal to your VPS instance.",
};

export default async function SshTerminalPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/vps/ssh/terminal");

  const rows = await listUserInstances(user.id).catch(() => []);

  const instances = rows.map((r) => ({
    id: r.id,
    name: r.name,
    ip_public: r.ip_public,
    ip_private: r.ip_private,
  }));

  return <SshTerminalView instances={instances} />;
}
