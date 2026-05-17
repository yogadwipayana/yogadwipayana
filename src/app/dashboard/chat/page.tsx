import type { Metadata } from "next";

import { DashboardShell } from "../shell";

export const metadata: Metadata = {
  title: "Chat AI · Dashboard",
  description: "Conversations powered by your AI router.",
};

export default function ChatPage() {
  return <DashboardShell toolId="chat" />;
}
