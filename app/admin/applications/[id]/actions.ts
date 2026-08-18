"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APPLICATION_STATUS_OPTIONS, REVIEW_STAGE_OPTIONS } from "@/lib/admin/constants";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import type {
  ApplicantPortalLinkFormState,
  AttachmentReviewFormState,
  InformationLinkFormState,
  InformationRequestFormState,
  ReviewFormState,
} from "@/lib/admin/types";
import {
  APPLICANT_PORTAL_VALID_DAYS,
  generateApplicantPortalToken,
  hashApplicantPortalToken,
} from "@/lib/application/applicant-portal";
import { deliverApplicantPortalAccess } from "@/lib/application/applicant-portal-delivery";
import {
  generateInformationResponseToken,
  hashInformationResponseToken,
  validateInformationRequestInput,
} from "@/lib/application/information-response";
import { IDEMPOTENCY_KEY_PATTERN } from "@/lib/application/policy";
import {
  isApplicantPortalEmailDeliveryEnabled,
  isApplicantCommunicationsEnabled,
  isApplicantPortalEnabled,
  isInformationResponseEnabled,
} from "@/lib/config/server";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function issueApplicantPortalLinkAction(
  _previousState: ApplicantPortalLinkFormState,
  formData: FormData,
): Promise<ApplicantPortalLinkFormState> {
  const adminUser = await requireAdminUser();
  if (!isApplicantPortalEnabled()) {
    return {
      message: "Applicant progress portals are not enabled in this environment.",
      status: "error",
    };
  }
  const applicationId = getFormValue(formData, "application_id");
  if (!IDEMPOTENCY_KEY_PATTERN.test(applicationId)) {
    return { message: "Invalid application id.", status: "error" };
  }

  try {
    const token = generateApplicantPortalToken();
    const tokenHash = hashApplicantPortalToken(token);
    if (!tokenHash) throw new Error("Unable to create a secure portal link.");
    const expiresAt = new Date(
      Date.now() + APPLICANT_PORTAL_VALID_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.rpc(
      "admin_issue_affiliate_application_portal_access",
      {
        p_application_id: applicationId,
        p_token_hash: tokenHash,
        p_expires_at: expiresAt,
        p_actor_user_id: adminUser.id,
        p_actor_email: adminUser.email!,
      },
    );
    if (error) {
      throw new Error(
        error.code === "PGRST202"
          ? "The Batch 1B applicant portal migration must be applied first."
          : error.message,
      );
    }
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      message:
        "New private portal link generated. It is shown once and replaces any previous link.",
      status: "success",
      portalPath: `/application-progress/${token}`,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to generate the portal link.",
      status: "error",
    };
  }
}

export async function emailApplicantPortalLinkAction(
  _previousState: ApplicantPortalLinkFormState,
  formData: FormData,
): Promise<ApplicantPortalLinkFormState> {
  const adminUser = await requireAdminUser();
  if (!isApplicantCommunicationsEnabled() || !isApplicantPortalEnabled() ||
    !isApplicantPortalEmailDeliveryEnabled()) {
    return {
      message: "Applicant portal email delivery is not enabled in this environment.",
      status: "error",
    };
  }
  const applicationId = getFormValue(formData, "application_id");
  if (!IDEMPOTENCY_KEY_PATTERN.test(applicationId)) {
    return { message: "Invalid application id.", status: "error" };
  }
  try {
    const outcome = await deliverApplicantPortalAccess({
      applicationId,
      actor: { userId: adminUser.id, email: adminUser.email },
      reason: "manual_applicant_update",
    });
    revalidatePath(`/admin/applications/${applicationId}`);
    return outcome.status === "sent"
      ? {
          message:
            "Secure portal email accepted for delivery. The new link now replaces the previous link.",
          status: "success",
        }
      : {
          message:
            "Portal email was not delivered. The applicant's previous portal link remains active.",
          status: "error",
        };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to email portal access.",
      status: "error",
    };
  }
}

async function deliverMaterialPortalUpdate({
  applicationId,
  actorUserId,
  actorEmail,
  reason,
  secondaryPath,
}: {
  applicationId: string;
  actorUserId: string;
  actorEmail: string;
  reason:
    | "more_information_required"
    | "replacement_required"
    | "approved"
    | "rejected"
    | "affiliate_activated";
  secondaryPath?: string;
}) {
  if (!isApplicantCommunicationsEnabled() || !isApplicantPortalEmailDeliveryEnabled()) return null;
  try {
    return await deliverApplicantPortalAccess({
      applicationId,
      actor: { userId: actorUserId, email: actorEmail },
      reason,
      secondaryPath,
    });
  } catch {
    return {
      status: "failed",
      errorCode: "PORTAL_DELIVERY_UNAVAILABLE",
    } as const;
  }
}

export async function reissueInformationResponseLinkAction(
  _previousState: InformationLinkFormState,
  formData: FormData,
): Promise<InformationLinkFormState> {
  const adminUser = await requireAdminUser();
  const applicationId = getFormValue(formData, "application_id");
  const requestId = getFormValue(formData, "request_id");
  if (
    !IDEMPOTENCY_KEY_PATTERN.test(applicationId) ||
    !IDEMPOTENCY_KEY_PATTERN.test(requestId)
  ) {
    return { message: "Invalid information request.", status: "error" };
  }

  try {
    const token = generateInformationResponseToken();
    const tokenHash = hashInformationResponseToken(token);
    if (!tokenHash) throw new Error("Unable to create a secure response link.");
    const supabase = createAdminSupabaseClient();
    const { data: linkedApplicationId, error } = await supabase.rpc(
      "admin_reissue_affiliate_information_response_link",
      {
        p_request_id: requestId,
        p_token_hash: tokenHash,
        p_actor_user_id: adminUser.id,
        p_actor_email: adminUser.email!,
      },
    );
    if (error || linkedApplicationId !== applicationId) {
      throw new Error(
        error?.code === "PGRST202"
          ? "The replacement-link recovery migration must be applied first."
          : error?.message || "Unable to generate a new replacement link.",
      );
    }
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      message: "New replacement link generated. The previous link is now invalid.",
      status: "success",
      responsePath: `/application-response/${token}`,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "Unable to generate a new replacement link.",
      status: "error",
    };
  }
}

export async function reviewInformationAttachmentAction(
  _previousState: AttachmentReviewFormState,
  formData: FormData
): Promise<AttachmentReviewFormState> {
  const adminUser = await requireAdminUser();
  const attachmentId = getFormValue(formData, "attachment_id");
  const applicationId = getFormValue(formData, "application_id");
  const decision = getFormValue(formData, "decision");
  const reviewNote = getFormValue(formData, "review_note");
  if (
    !IDEMPOTENCY_KEY_PATTERN.test(attachmentId) ||
    !IDEMPOTENCY_KEY_PATTERN.test(applicationId)
  ) {
    return { message: "Invalid attachment.", status: "error" };
  }
  if (!["accepted", "replacement_requested"].includes(decision)) {
    return { message: "Select a valid review decision.", status: "error" };
  }
  if (decision === "replacement_requested" && !reviewNote) {
    return {
      message: "Explain what the applicant should replace.",
      status: "error",
    };
  }
  if (reviewNote.length > 1000) {
    return { message: "Review instructions cannot exceed 1,000 characters.", status: "error" };
  }

  try {
    const replacementToken =
      decision === "replacement_requested" ? generateInformationResponseToken() : "";
    const replacementTokenHash = replacementToken
      ? hashInformationResponseToken(replacementToken)
      : null;
    const supabase = createAdminSupabaseClient();
    const { data: reviewedApplicationId, error } = await supabase.rpc(
      "admin_review_affiliate_information_attachment",
      {
        p_attachment_id: attachmentId,
        p_decision: decision,
        p_review_note: reviewNote,
        p_actor_user_id: adminUser.id,
        p_actor_email: adminUser.email!,
        p_replacement_token_hash: replacementTokenHash,
      },
    );
    if (error || reviewedApplicationId !== applicationId) {
      throw new Error(
        error?.code === "PGRST202"
          ? "The secure file-response migration must be applied first."
          : error?.message || "The attachment could not be reviewed.",
      );
    }
    const portalDelivery =
      decision === "replacement_requested"
        ? await deliverMaterialPortalUpdate({
            applicationId,
            actorUserId: adminUser.id,
            actorEmail: adminUser.email!,
            reason: "replacement_required",
            secondaryPath: `/application-response/${replacementToken}`,
          })
        : null;
    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      message:
        decision === "accepted"
          ? "File accepted and recorded in the audit trail."
          : portalDelivery?.status === "sent"
            ? "Replacement requested and the secure applicant email was accepted for delivery."
            : "Replacement requested and recorded. No applicant portal email was delivered.",
      status: "success",
      ...(replacementToken
        ? { responsePath: `/application-response/${replacementToken}` }
        : {}),
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Unable to review the file.",
      status: "error",
    };
  }
}

async function updateApplicationStageAndStatus({
  applicationId,
  reviewStage,
  status,
  actorUserId,
  actorEmail,
}: {
  applicationId: string;
  reviewStage: string;
  status: string;
  actorUserId: string;
  actorEmail: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.rpc("admin_transition_affiliate_application", {
    p_application_id: applicationId,
    p_review_stage: reviewStage,
    p_status: status,
    p_actor_user_id: actorUserId,
    p_actor_email: actorEmail,
  });

  if (error) {
    throw new Error(
      error.code === "PGRST202"
        ? "Batch 1A.3 database migration is required before workflow actions can be used."
        : error.message
    );
  }

  if (["approved", "rejected", "activated_affiliate"].includes(reviewStage)) {
    await deliverMaterialPortalUpdate({
      applicationId,
      actorUserId,
      actorEmail,
      reason:
        reviewStage === "activated_affiliate"
          ? "affiliate_activated"
          : reviewStage as "approved" | "rejected",
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
}

export async function updateApplicationReviewAction(
  _previousState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const adminUser = await requireAdminUser();

  const applicationId = getFormValue(formData, "applicationId");
  const internalNotes = getFormValue(formData, "internal_notes");

  if (!applicationId) {
    return {
      message: "Missing application id.",
      status: "error",
    };
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { data: changed, error } = await supabase.rpc(
      "admin_update_affiliate_application_notes",
      {
        p_application_id: applicationId,
        p_internal_notes: internalNotes,
        p_actor_user_id: adminUser.id,
        p_actor_email: adminUser.email!,
      }
    );

    if (error) {
      throw new Error(
        error.code === "PGRST202"
          ? "Batch 1A.3 database migration is required before notes can be changed."
          : error.message
      );
    }

    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);

    return {
      message: changed ? "Notes updated and recorded in the audit trail." : "No note changes to save.",
      status: "success",
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to save the application update.",
      status: "error",
    };
  }
}

export async function triggerPipelineAction(formData: FormData) {
  const adminUser = await requireAdminUser();

  const applicationId = getFormValue(formData, "applicationId");
  const reviewStage = getFormValue(formData, "review_stage");
  const status = getFormValue(formData, "status");

  if (!applicationId) {
    throw new Error("Missing application id.");
  }

  if (!REVIEW_STAGE_OPTIONS.includes(reviewStage)) {
    throw new Error("Invalid review stage selected.");
  }

  if (!APPLICATION_STATUS_OPTIONS.includes(status)) {
    throw new Error("Invalid application status selected.");
  }

  await updateApplicationStageAndStatus({
    applicationId,
    reviewStage,
    status,
    actorUserId: adminUser.id,
    actorEmail: adminUser.email!,
  });

  redirect(`/admin/applications/${applicationId}`);
}

export async function createInformationRequestAction(
  _previousState: InformationRequestFormState,
  formData: FormData
): Promise<InformationRequestFormState> {
  const adminUser = await requireAdminUser();
  if (!isInformationResponseEnabled()) {
    return {
      message: "Secure information responses are not enabled in this environment.",
      status: "error",
    };
  }

  const applicationId = getFormValue(formData, "applicationId");
  if (!IDEMPOTENCY_KEY_PATTERN.test(applicationId)) {
    return { message: "Invalid application id.", status: "error" };
  }

  try {
    const request = validateInformationRequestInput({
      summary: getFormValue(formData, "request_summary"),
      details: getFormValue(formData, "request_details"),
      validDays: Number(getFormValue(formData, "valid_days")),
    });
    const token = generateInformationResponseToken();
    const tokenHash = hashInformationResponseToken(token);
    if (!tokenHash) throw new Error("Unable to create a secure response link.");
    const expiresAt = new Date(
      Date.now() + request.validDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.rpc(
      "admin_create_affiliate_information_request",
      {
        p_application_id: applicationId,
        p_request_summary: request.summary,
        p_request_details: request.details,
        p_expires_at: expiresAt,
        p_token_hash: tokenHash,
        p_actor_user_id: adminUser.id,
        p_actor_email: adminUser.email!,
      }
    );
    if (error) {
      throw new Error(
        error.code === "PGRST202"
          ? "The secure information-response migration must be applied first."
          : error.message
      );
    }

    const portalDelivery = await deliverMaterialPortalUpdate({
      applicationId,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email!,
      reason: "more_information_required",
      secondaryPath: `/application-response/${token}`,
    });

    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      message:
        portalDelivery?.status === "sent"
          ? "Secure request created and the applicant email was accepted for delivery."
          : "Secure request created. No applicant portal email was delivered; the test link is shown once.",
      status: "success",
      responsePath: `/application-response/${token}`,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error ? error.message : "Unable to create the information request.",
      status: "error",
    };
  }
}
