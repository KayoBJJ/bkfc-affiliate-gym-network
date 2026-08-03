import "server-only";

import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { hashApplicantPortalToken } from "./applicant-portal";
import { hashInformationResponseToken } from "./information-response";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicInformationRequest = {
  id: string;
  applicationId: string;
  applicationReference: string;
  gymName: string;
  requestSummary: string;
  requestDetails: string | null;
  replacementInstructions: string | null;
  status: "open" | "responded" | "revoked" | "expired";
  expiresAt: string;
};

export async function getPublicInformationRequest(token: string) {
  const tokenHash = hashInformationResponseToken(token);
  if (!tokenHash) return null;
  const supabase = createAdminSupabaseClient();
  const { data: request, error } = await supabase
    .from("affiliate_application_information_requests")
    .select("id, application_id, request_summary, request_details, status, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !request) return null;

  const { data: application, error: applicationError } = await supabase
    .from("affiliate_applications")
    .select("application_reference, gym_name")
    .eq("id", request.application_id)
    .maybeSingle();
  if (applicationError || !application) return null;

  const { data: replacement } = await supabase
    .from("affiliate_application_information_attachments")
    .select("review_note")
    .eq("request_id", request.id)
    .eq("status", "replacement_requested")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status =
    request.status === "open" && new Date(request.expires_at).getTime() <= Date.now()
      ? "expired"
      : request.status;
  return {
    id: request.id,
    applicationId: request.application_id,
    applicationReference: application.application_reference ?? request.application_id,
    gymName: application.gym_name,
    requestSummary: request.request_summary,
    requestDetails: request.request_details,
    replacementInstructions: replacement?.review_note ?? null,
    status,
    expiresAt: request.expires_at,
  } as PublicInformationRequest;
}

export async function getPortalInformationRequest(
  portalToken: string,
  requestId: string,
): Promise<PublicInformationRequest | null> {
  const portalTokenHash = hashApplicantPortalToken(portalToken);
  if (!portalTokenHash || !UUID_PATTERN.test(requestId)) return null;

  const supabase = createAdminSupabaseClient();
  const { data: access, error: accessError } = await supabase
    .from("affiliate_application_portal_access")
    .select("application_id, expires_at, revoked_at, activated_at")
    .eq("token_hash", portalTokenHash)
    .maybeSingle();
  if (
    accessError ||
    !access ||
    !access.activated_at ||
    access.revoked_at ||
    new Date(access.expires_at).getTime() <= Date.now()
  ) {
    return null;
  }

  const { data: request, error } = await supabase
    .from("affiliate_application_information_requests")
    .select("id, application_id, request_summary, request_details, status, expires_at")
    .eq("id", requestId)
    .eq("application_id", access.application_id)
    .maybeSingle();
  if (error || !request) return null;

  const { data: application, error: applicationError } = await supabase
    .from("affiliate_applications")
    .select("application_reference, gym_name, review_stage")
    .eq("id", request.application_id)
    .maybeSingle();
  if (applicationError || !application) return null;
  if (request.status === "open" && application.review_stage !== "follow_up_required") {
    return null;
  }

  const { data: replacement } = await supabase
    .from("affiliate_application_information_attachments")
    .select("review_note")
    .eq("request_id", request.id)
    .eq("status", "replacement_requested")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const status =
    request.status === "open" && new Date(request.expires_at).getTime() <= Date.now()
      ? "expired"
      : request.status;
  return {
    id: request.id,
    applicationId: request.application_id,
    applicationReference: application.application_reference ?? request.application_id,
    gymName: application.gym_name,
    requestSummary: request.request_summary,
    requestDetails: request.request_details,
    replacementInstructions: replacement?.review_note ?? null,
    status,
    expiresAt: request.expires_at,
  } as PublicInformationRequest;
}
