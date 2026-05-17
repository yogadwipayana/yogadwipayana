import type { Metadata } from "next";

import { AiOverview } from "../views";

export const metadata: Metadata = {
  title: "AI Router · Dashboard",
  description: "Manage AI routes, models, and fallback chains.",
};

export default function AiPage() {
  return <AiOverview />;
}
