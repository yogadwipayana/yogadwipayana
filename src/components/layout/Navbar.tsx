import { cookies } from "next/headers";

import { createClient } from "@/utils/supabase/server";

import { NavbarClient } from "./NavbarClient";

export async function Navbar() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <NavbarClient
      user={user?.email ? { email: user.email } : null}
    />
  );
}
