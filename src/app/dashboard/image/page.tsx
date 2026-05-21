import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listGeneratedImages } from "@/lib/server/image-service";
import { createClient } from "@/utils/supabase/server";

import { DashboardShell } from "../shell";
import { ImageWorkspace } from "./workspace";

export const metadata: Metadata = {
  title: "Image Studio · Dashboard",
  description: "Generate images from text prompts.",
};

export default async function ImagePage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  const images = await listGeneratedImages(supabase, user.id, { limit: 60 });

  return (
    <DashboardShell toolId="image">
      <ImageWorkspace initialImages={images} />
    </DashboardShell>
  );
}
