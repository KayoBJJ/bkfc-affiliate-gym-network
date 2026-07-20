import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  AffiliateApplication,
  ApplicationStageHistoryEntry,
} from "@/lib/admin/types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKET } from "@/lib/application/policy";

export function createAdminSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
}

function storagePathFromLegacyUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.origin !== new URL(getSupabaseUrl()).origin) return null;
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(url.pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

const applicationSelect = `
  id,
  application_reference,
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
  logo_path,
  gym_photo_paths,
  fighter_list_path,
  promo_video_link,
  review_consent,
  follow_up_consent,
  bkfc_app_access_interest,
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

  if (!data) return null;

  const application = data as AffiliateApplication;
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 10 * 60);
    return signed?.signedUrl ?? null;
  };

  application.logo_access_url =
    (await sign(application.logo_path || storagePathFromLegacyUrl(application.logo_url))) ||
    application.logo_url;
  application.fighter_list_access_url =
    (await sign(application.fighter_list_path || storagePathFromLegacyUrl(application.fighter_list_url))) ||
    application.fighter_list_url;
  if (application.gym_photo_paths?.length) {
    application.gym_photo_access_urls = (
      await Promise.all(application.gym_photo_paths.map(sign))
    ).filter((url): url is string => Boolean(url));
  } else {
    application.gym_photo_access_urls = await Promise.all(
      (application.gym_photo_urls ?? []).map(async (url) =>
        (await sign(storagePathFromLegacyUrl(url))) || url,
      ),
    );
  }

  return application;
}

export async function getApplicationStageHistory(applicationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("application_stage_history")
    .select("id, application_id, review_stage, status, changed_at")
    .eq("application_id", applicationId)
    .order("changed_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load application stage history: ${error.message}`);
  }

  return (data ?? []) as ApplicationStageHistoryEntry[];
}

export async function getAllApplicationStageHistory() {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("application_stage_history")
    .select("id, application_id, review_stage, status, changed_at")
    .order("changed_at", { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Failed to load application stage history: ${error.message}`);
  }

  return (data ?? []) as ApplicationStageHistoryEntry[];
}
