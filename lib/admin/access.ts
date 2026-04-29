import { createAdminSupabaseClient } from "@/lib/admin/supabase";

export async function isAllowedAdminEmail(email: string | undefined | null) {
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .ilike("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to verify admin access: ${error.message}`);
  }

  return Boolean(data);
}
