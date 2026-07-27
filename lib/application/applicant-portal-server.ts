import "server-only";

import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  getApplicantProgressSummary,
  hashApplicantPortalToken,
} from "./applicant-portal";

export type ApplicantPortalRequest = {
  id: string;
  summary: string;
  details: string | null;
  status: "open" | "responded" | "revoked" | "expired";
  expiresAt: string;
  respondedAt: string | null;
  latestFileStatus: string | null;
  latestFileVersion: number | null;
  replacementInstructions: string | null;
};

export type ApplicantPortalView = {
  applicationId: string;
  applicationReference: string;
  gymName: string;
  submittedAt: string;
  progress: ReturnType<typeof getApplicantProgressSummary>;
  requests: ApplicantPortalRequest[];
};

export async function getApplicantPortalView(token: string): Promise<ApplicantPortalView | null> {
  const tokenHash = hashApplicantPortalToken(token);
  if (!tokenHash) return null;
  const supabase = createAdminSupabaseClient();
  const { data: access, error: accessError } = await supabase
    .from("affiliate_application_portal_access")
    .select("application_id, expires_at, revoked_at, activated_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (
    accessError ||
    !access ||
    access.revoked_at ||
    !access.activated_at ||
    new Date(access.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const [{ data: application, error: applicationError }, { data: requests, error: requestsError }] =
    await Promise.all([
      supabase
        .from("affiliate_applications")
        .select("id, application_reference, gym_name, created_at, review_stage")
        .eq("id", access.application_id)
        .maybeSingle(),
      supabase
        .from("affiliate_application_information_requests")
        .select("id, request_summary, request_details, status, expires_at, responded_at")
        .eq("application_id", access.application_id)
        .order("created_at", { ascending: false }),
    ]);
  if (applicationError || !application || requestsError) return null;

  const requestIds = (requests ?? []).map((request) => request.id);
  const latestAttachmentByRequest = new Map<
    string,
    { status: string; version: number; review_note: string | null }
  >();
  if (requestIds.length > 0) {
    const { data: attachments, error: attachmentError } = await supabase
      .from("affiliate_application_information_attachments")
      .select("request_id, status, version, review_note")
      .in("request_id", requestIds)
      .order("version", { ascending: false });
    if (attachmentError) return null;
    for (const attachment of attachments ?? []) {
      if (!latestAttachmentByRequest.has(attachment.request_id)) {
        latestAttachmentByRequest.set(attachment.request_id, attachment);
      }
    }
  }

  return {
    applicationId: application.id,
    applicationReference: application.application_reference ?? application.id,
    gymName: application.gym_name,
    submittedAt: application.created_at,
    progress: getApplicantProgressSummary(application.review_stage),
    requests: (requests ?? []).map((request) => {
      const attachment = latestAttachmentByRequest.get(request.id);
      return {
        id: request.id,
        summary: request.request_summary,
        details: request.request_details,
        status:
          request.status === "open" &&
          new Date(request.expires_at).getTime() <= Date.now()
            ? "expired"
            : request.status,
        expiresAt: request.expires_at,
        respondedAt: request.responded_at,
        latestFileStatus: attachment?.status ?? null,
        latestFileVersion: attachment?.version ?? null,
        replacementInstructions:
          attachment?.status === "replacement_requested"
            ? attachment.review_note
            : null,
      };
    }),
  };
}
