import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  AffiliateApplication,
  ApplicationStageHistoryEntry,
} from "@/lib/admin/types";
import {
  attachApplicationFileAccess,
  normalizeAffiliateApplication,
  queryAffiliateApplicationsCompatibly,
  storagePathFromLegacyValue,
} from "@/lib/admin/applicationCompatibility";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";
import { STORAGE_BUCKET } from "@/lib/application/policy";

export function createAdminSupabaseClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey());
}

export async function getAffiliateApplications() {
  const supabase = createAdminSupabaseClient();
  const { data, error, schema } = await queryAffiliateApplicationsCompatibly(
    async (selection) => {
      const result = await supabase
        .from("affiliate_applications")
        .select(selection)
        .order("created_at", { ascending: false });
      return {
        data: result.data as Record<string, unknown>[] | null,
        error: result.error,
      };
    },
  );

  if (error) {
    throw new Error(`Failed to load affiliate applications: ${error.message}`);
  }

  return (data ?? []).map((row) => normalizeAffiliateApplication(row, schema));
}

export async function getAffiliateApplicationById(id: string) {
  const supabase = createAdminSupabaseClient();

  const { data, error, schema } = await queryAffiliateApplicationsCompatibly(
    async (selection) => {
      const result = await supabase
        .from("affiliate_applications")
        .select(selection)
        .eq("id", id)
        .maybeSingle();
      return {
        data: result.data as Record<string, unknown> | null,
        error: result.error,
      };
    },
  );

  if (error) {
    throw new Error(`Failed to load affiliate application: ${error.message}`);
  }

  if (!data) return null;

  const application = normalizeAffiliateApplication(data, schema);
  const sign = async (path: string | null) => {
    if (!path) return null;
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 10 * 60);
    return signed?.signedUrl ?? null;
  };

  return attachApplicationFileAccess(
    application,
    sign,
    (value) => storagePathFromLegacyValue(
      value,
      application.id,
      getSupabaseUrl(),
      STORAGE_BUCKET,
    ),
  );
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
