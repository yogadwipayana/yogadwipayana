import { cookies } from "next/headers";

import { createClient } from "@/utils/supabase/server";

export async function canUseAdminTools(): Promise<boolean> {
  const ownerId = process.env.OWNER_USER_ID;
  if (!ownerId) return false;

  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id === ownerId;
}
