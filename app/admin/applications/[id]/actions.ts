"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APPLICATION_STATUS_OPTIONS, REVIEW_STAGE_OPTIONS } from "@/lib/admin/constants";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import type {
  InformationRequestFormState,
  ReviewFormState,
} from "@/lib/admin/types";
import {
  generateInformationResponseToken,
  hashInformationResponseToken,
  validateInformationRequestInput,
} from "@/lib/application/information-response";
import { IDEMPOTENCY_KEY_PATTERN } from "@/lib/application/policy";
import { isInformationResponseEnabled } from "@/lib/config/server";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);
    return {
      message:
        "Secure request created. This test link is shown once; do not share it publicly.",
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
