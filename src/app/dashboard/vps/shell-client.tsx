"use client";

import { useSearchParams, useSelectedLayoutSegment } from "next/navigation";

import { DashboardShell } from "../shell";
import type { VpsInstance as ApiVpsInstance } from "@/lib/client/vps-api";

export function VpsDashboardShell({
  instances,
  children,
}: {
  instances: ApiVpsInstance[];
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const segment = useSelectedLayoutSegment();
  const requested = params.get("instance");
  const initialActiveId =
    requested && instances.some((i) => i.id === requested)
      ? requested
      : instances[0]?.id;

  // On /dashboard/vps (no child segment) we want the shell's built-in
  // renderMain to display the active instance view, so we deliberately
  // omit children. Sub-routes (byok/terminal/reset/reinstall) render via
  // children inside the shell's <main>.
  return (
    <DashboardShell
      toolId="vps"
      instances={instances}
      initialActiveId={initialActiveId}
    >
      {segment === null ? undefined : children}
    </DashboardShell>
  );
}
