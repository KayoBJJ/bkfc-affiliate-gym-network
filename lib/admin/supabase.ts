import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { AffiliateApplication } from "@/lib/admin/types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createAdminSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
}

const applicationSelect = `
  id,
  created_at,
  gym_name,
  city_country,
  country,
  region,
  contact_person,
  email,
  phone,
  website_instagram,
  disciplines_offered,
  logo_url,
  gym_photo_urls,
  fighter_list_url,
  promo_video_link,
  review_consent,
  follow_up_consent,
  status,
  review_stage,
  internal_notes
`;

export async function getAffiliateApplications() {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("affiliate_applications")
    .select(applicationSelect)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load affiliate applications: ${error.message}`);
  }

  return (data ?? []) as AffiliateApplication[];
}

export async function getAffiliateApplicationById(id: string) {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("affiliate_applications")
    .select(applicationSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load affiliate application: ${error.message}`);
  }

  return data as AffiliateApplication | null;
}
