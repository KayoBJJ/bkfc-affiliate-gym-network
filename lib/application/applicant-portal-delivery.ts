import "server-only";

import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  getApplicationPublicUrl,
  isApplicantPortalEmailDeliveryEnabled,
  isApplicantPortalEnabled,
} from "@/lib/config/server";
import {
  APPLICANT_PORTAL_VALID_DAYS,
  generateApplicantPortalToken,
  hashApplicantPortalToken,
} from "./applicant-portal";
import {
  sendApplicantPortalAccessEmail,
  type ApplicantPortalDeliveryReason,
  type ApplicantPortalEmailApplication,
  type ApplicantPortalEmailOutcome,
} from "./applicant-portal-email";

type PortalDeliveryActor = {
  userId?: string | null;
  email?: string | null;
};

export type PreparedApplicantPortalDelivery = {
  accessId: string;
  portalUrl: string;
};

function absoluteApplicationUrl(path: string) {
  return new URL(path, `${getApplicationPublicUrl()}/`).toString();
}

export async function prepareApplicantPortalDelivery({
  applicationId,
  actor,
  reason,
}: {
  applicationId: string;
  actor?: PortalDeliveryActor;
  reason: ApplicantPortalDeliveryReason;
}): Promise<PreparedApplicantPortalDelivery> {
  const token = generateApplicantPortalToken();
  const tokenHash = hashApplicantPortalToken(token);
  if (!tokenHash) throw new Error("Unable to create a secure portal link.");
  const expiresAt = new Date(
    Date.now() + APPLICANT_PORTAL_VALID_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await createAdminSupabaseClient().rpc(
    "prepare_affiliate_application_portal_delivery",
    {
      p_application_id: applicationId,
      p_token_hash: tokenHash,
      p_expires_at: expiresAt,
      p_actor_user_id: actor?.userId ?? null,
      p_actor_email: actor?.email ?? null,
      p_delivery_reason: reason,
    },
  );
  if (error || typeof data !== "string") {
    throw new Error(
      error?.code === "PGRST202"
        ? "The Batch 1B Slice 2 migration must be applied first."
        : error?.message || "Unable to prepare portal delivery.",
    );
  }
  return {
    accessId: data,
    portalUrl: absoluteApplicationUrl(`/application-progress/${token}`),
  };
}

export async function completeApplicantPortalDelivery({
  accessId,
  outcome,
  actor,
}: {
  accessId: string;
  outcome: ApplicantPortalEmailOutcome;
  actor?: PortalDeliveryActor;
}) {
  const { error } = await createAdminSupabaseClient().rpc(
    "complete_affiliate_application_portal_delivery",
    {
      p_access_id: accessId,
      p_succeeded: outcome.status === "sent",
      p_provider_message_id:
        outcome.status === "sent" ? outcome.providerMessageId : null,
      p_error_code: outcome.status === "failed" ? outcome.errorCode : null,
      p_actor_user_id: actor?.userId ?? null,
      p_actor_email: actor?.email ?? null,
    },
  );
  if (error) throw new Error(error.message);
}

export async function deliverApplicantPortalAccess({
  applicationId,
  actor,
  reason,
  secondaryPath,
}: {
  applicationId: string;
  actor?: PortalDeliveryActor;
  reason: ApplicantPortalDeliveryReason;
  secondaryPath?: string;
}): Promise<ApplicantPortalEmailOutcome> {
  if (!isApplicantPortalEnabled() || !isApplicantPortalEmailDeliveryEnabled()) {
    return { status: "failed", errorCode: "PORTAL_EMAIL_DELIVERY_DISABLED" };
  }
  const supabase = createAdminSupabaseClient();
  const { data: application, error } = await supabase
    .from("affiliate_applications")
    .select("application_reference, contact_person, email, gym_name")
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !application) {
    return { status: "failed", errorCode: "APPLICATION_UNAVAILABLE" };
  }
  const prepared = await prepareApplicantPortalDelivery({
    applicationId,
    actor,
    reason,
  });
  const emailApplication: ApplicantPortalEmailApplication = {
    applicationReference: application.application_reference ?? applicationId,
    contactPerson: application.contact_person,
    email: application.email,
    gymName: application.gym_name,
  };
  const outcome = await sendApplicantPortalAccessEmail({
    application: emailApplication,
    portalUrl: prepared.portalUrl,
    reason,
    ...(secondaryPath ? { secondaryUrl: absoluteApplicationUrl(secondaryPath) } : {}),
  });
  await completeApplicantPortalDelivery({
    accessId: prepared.accessId,
    outcome,
    actor,
  });
  return outcome;
}
