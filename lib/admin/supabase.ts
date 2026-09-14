import "server-only";

import { createClient } from "@supabase/supabase-js";
import type {
  AffiliateApplication,
  ApplicationCommunicationStatus,
  ApplicationAuditEvent,
  ApplicationInformationRequest,
  ApplicationStageHistoryEntry,
  ApplicationPaymentStatus,
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

export async function getApplicationCommunicationStatus(applicationId: string) {
  const supabase = createAdminSupabaseClient();
  const [outboxResult, templateResult] = await Promise.all([
    supabase.from("affiliate_application_notification_outbox")
      .select("id, notification_type, delivery_status, attempt_count, last_error_code, created_at, sent_at, template:affiliate_application_notification_templates(version, locale, approval_status)")
      .eq("application_id", applicationId).order("created_at", { ascending: false }),
    supabase.from("affiliate_application_notification_templates")
      .select("notification_type").eq("approval_status", "approved"),
  ]);
  const missing = ["42P01", "42703", "PGRST204", "PGRST205"];
  if (missing.includes(outboxResult.error?.code ?? "") ||
    missing.includes(templateResult.error?.code ?? "")) return null;
  if (outboxResult.error || templateResult.error) {
    throw new Error("Failed to load applicant communication status.");
  }
  return {
    rows: outboxResult.data ?? [],
    approvedTemplateTypes: (templateResult.data ?? []).map((row) => row.notification_type),
  } as unknown as ApplicationCommunicationStatus;
}

export async function getApplicationPaymentStatus(applicationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: coordination, error } = await supabase
    .from("affiliate_application_payment_coordination")
    .select("plan_code,payment_status,payment_operation_state,current_payment_request_id,payment_requested_at,payment_link_sent_at,paid_at,cancelled_at,refunded_at,subscription_status,last_renewal_paid_at,past_due_at,subscription_cancelled_at,last_operational_error_code")
    .eq("application_id", applicationId).maybeSingle();
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code ?? "")) return null;
  if (error) throw new Error("Failed to load application payment status.");
  if (!coordination) return null;
  const commandResult = await supabase.from("affiliate_application_payment_command_outbox")
    .select("command_id,command_type,delivery_status,attempt_count,next_attempt_at")
    .eq("application_id", applicationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (commandResult.error) throw new Error("Failed to load payment command status.");
  const command = commandResult.data;
  return {
    ...coordination,
    delivery_status: command?.delivery_status ?? null,
    command_id: command?.command_id ?? null,
    command_type: command?.command_type ?? null,
    attempt_count: command?.attempt_count ?? null,
    next_attempt_at: command?.next_attempt_at ?? null,
  } as ApplicationPaymentStatus;
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
  const attachmentsByRequest = new Map<
    string,
    ApplicationInformationRequest["attachments"]
  >();
  if (requestIds.length > 0) {
    const [{ data: responses, error: responseError }, { data: attachments, error: attachmentError }] =
      await Promise.all([
        supabase
          .from("affiliate_application_information_responses")
          .select("request_id, response_text, submitted_at")
          .in("request_id", requestIds),
        supabase
          .from("affiliate_application_information_attachments")
          .select(
            "id, request_id, version, storage_path, original_filename, content_type, size_bytes, status, uploaded_at, reviewed_at, reviewed_by_email, review_note",
          )
          .in("request_id", requestIds)
          .order("version", { ascending: false }),
      ]);
    if (responseError) {
      throw new Error(`Failed to load information responses: ${responseError.message}`);
    }
    if (attachmentError && !isMissingAuditTable(attachmentError)) {
      throw new Error(`Failed to load information attachments: ${attachmentError.message}`);
    }
    for (const response of responses ?? []) {
      responsesByRequest.set(response.request_id, response);
    }
    for (const attachment of attachments ?? []) {
      const accessUrl =
        attachment.status === "uploading" || attachment.status === "rejected"
          ? null
          : (
              await supabase.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(attachment.storage_path, 10 * 60, {
                  download: true,
                })
            ).data?.signedUrl ?? null;
      const list = attachmentsByRequest.get(attachment.request_id) ?? [];
      list.push({
        id: attachment.id,
        request_id: attachment.request_id,
        version: attachment.version,
        original_filename: attachment.original_filename,
        content_type: attachment.content_type,
        size_bytes: Number(attachment.size_bytes),
        status: attachment.status,
        uploaded_at: attachment.uploaded_at,
        reviewed_at: attachment.reviewed_at,
        reviewed_by_email: attachment.reviewed_by_email,
        review_note: attachment.review_note,
        access_url: accessUrl,
      });
      attachmentsByRequest.set(attachment.request_id, list);
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
      attachments: attachmentsByRequest.get(request.id) ?? [],
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

export async function getGymControlStatus(applicationId: string) {
  const db = createAdminSupabaseClient();
  const [identity, remote, commands] = await Promise.all([
    db.from("affiliate_applications").select("source_system").eq("id", applicationId).maybeSingle(),
    db.from("bkfc_gym_remote_state").select("state,listing_version,confirmed_visible,delisted,cancellation_requested_mode,observed_at,visibility_confirmed_at").eq("application_id", applicationId).maybeSingle(),
    db.from("bkfc_gym_control_commands").select("command_id,command_type,delivery_status,attempt_count,total_attempt_count,last_code,created_at,next_attempt_at").eq("application_id", applicationId).order("sequence_id", { ascending: false }).limit(10),
  ]);
  if (identity.error) throw new Error("Failed to load BKFC source identity.");
  if (identity.data?.source_system !== "bkfc") return null;
  const missing = ["42P01", "42703", "PGRST204", "PGRST205"];
  if (missing.includes(remote.error?.code ?? "") || missing.includes(commands.error?.code ?? "")) return { available: false as const, remote: null, commands: [] };
  if (remote.error || commands.error) throw new Error("Failed to load BKFC control state.");
  return { available: true as const, remote: remote.data, commands: commands.data ?? [] };
}
