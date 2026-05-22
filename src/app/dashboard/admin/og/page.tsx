import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/utils/supabase/server";
import { listGeneratedImages } from "@/lib/server/image-service";
import { OgAdminClient } from "./OgAdminClient";

export const metadata: Metadata = {
  title: "OG Image Generator",
  description: "Admin tool to regenerate avatar and Open Graph images.",
};

export default async function OgAdminPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId || user.id !== ownerId) {
    redirect("/dashboard");
  }

  const all = await listGeneratedImages(supabase, user.id, { limit: 30 });
  const initialImages = all.filter((img) => img.source === "admin");

  return <OgAdminClient initialImages={initialImages} />;
}
