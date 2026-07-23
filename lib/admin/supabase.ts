import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  AffiliateApplication,
  ApplicationAuditEvent,
  ApplicationInformationRequest,
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

function isMissingAuditTable(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

export async function getApplicationAuditEvents(applicationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("affiliate_application_audit_events")
    .select(
      "id, application_id, event_type, actor_user_id, actor_email, from_review_stage, to_review_stage, from_status, to_status, details, created_at"
    )
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  // Allows application code to be deployed before the reviewed migration.
  // Once the migration exists, every non-missing-table error remains fatal.
  if (isMissingAuditTable(error)) {
    return null;
  }

  if (error) {
    throw new Error(`Failed to load application audit events: ${error.message}`);
  }

  return (data ?? []) as ApplicationAuditEvent[];
}

export async function getApplicationInformationRequests(applicationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: requests, error } = await supabase
    .from("affiliate_application_information_requests")
    .select(
      "id, application_id, request_summary, request_details, status, expires_at, created_by_email, created_at, responded_at, revoked_at"
    )
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (isMissingAuditTable(error)) return null;
  if (error) {
    throw new Error(`Failed to load information requests: ${error.message}`);
  }

  const requestIds = (requests ?? []).map((request) => request.id);
  const responsesByRequest = new Map<
    string,
    { response_text: string; submitted_at: string }
  >();
  if (requestIds.length > 0) {
    const { data: responses, error: responseError } = await supabase
      .from("affiliate_application_information_responses")
      .select("request_id, response_text, submitted_at")
      .in("request_id", requestIds);
    if (responseError) {
      throw new Error(`Failed to load information responses: ${responseError.message}`);
    }
    for (const response of responses ?? []) {
      responsesByRequest.set(response.request_id, response);
    }
  }

  return (requests ?? []).map((request) => {
    const response = responsesByRequest.get(request.id);
    return {
      ...request,
      status:
        request.status === "open" &&
        new Date(request.expires_at).getTime() <= Date.now()
          ? "expired"
          : request.status,
      response_text: response?.response_text ?? null,
      response_submitted_at: response?.submitted_at ?? null,
    };
  }) as ApplicationInformationRequest[];
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
