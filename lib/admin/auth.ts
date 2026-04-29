import "server-only";

import { redirect } from "next/navigation";
import { isAllowedAdminEmail } from "@/lib/admin/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { user: null, isAllowed: false };
  }

  return {
    user,
    isAllowed: await isAllowedAdminEmail(user.email),
  };
}

export async function requireAdminUser() {
  const { user, isAllowed } = await getAdminSession();

  if (!user) {
    redirect("/admin/login");
  }

  if (!isAllowed) {
    redirect("/admin/login?error=unauthorized");
  }

  return user;
}
