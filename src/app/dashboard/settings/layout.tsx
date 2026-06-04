import { canUseAdminTools } from "./admin-access";
import { SettingsShellClient } from "./shell-client";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showAdminNav = await canUseAdminTools();

  return <SettingsShellClient showAdminNav={showAdminNav}>{children}</SettingsShellClient>;
}
