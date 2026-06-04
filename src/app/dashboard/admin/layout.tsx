import { canUseAdminTools } from "../settings/admin-access";
import { SettingsShellClient } from "../settings/shell-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAdminNav = await canUseAdminTools();

  return <SettingsShellClient showAdminNav={showAdminNav}>{children}</SettingsShellClient>;
}
