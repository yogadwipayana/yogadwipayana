import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { DashboardShell } from "../shell";
import { createClient } from "@/utils/supabase/server";
import type { VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";

export const metadata: Metadata = {
  title: "VPS Control · Dashboard",
  description: "Manage your VPS instances — monitor, start, stop, and configure.",
};

type SearchParams = Promise<{ instance?: string }>;

export default async function VpsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/dashboard/vps");

  const { data: rows, error } = await supabase
    .from("instance")
    .select(
      "id, external_instance_id, name, region, zone, status, provider_status, ip_public, ip_private, cpu, memory_gb, system_disk_gb, bandwidth_mbps, os_name, expires_at, source, last_synced_at, created_at, updated_at",
    )
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false });

  const instances = (error ? [] : (rows ?? [])) as unknown as ApiVpsInstance[];

  const params = await searchParams;
  const initialActiveId =
    params.instance && instances.some((i) => i.id === params.instance)
      ? params.instance
      : instances[0]?.id;

  return (
    <DashboardShell
      toolId="vps"
      instances={instances}
      initialActiveId={initialActiveId}
    />
  );
}
