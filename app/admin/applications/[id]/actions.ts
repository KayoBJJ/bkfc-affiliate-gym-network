"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APPLICATION_STATUS_OPTIONS, REVIEW_STAGE_OPTIONS } from "@/lib/admin/constants";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import type { ReviewFormState } from "@/lib/admin/types";

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function updateApplicationStageAndStatus({
  applicationId,
  reviewStage,
  status,
  internalNotes,
}: {
  applicationId: string;
  reviewStage: string;
  status: string;
  internalNotes?: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const updates: {
    review_stage: string;
    status: string;
    internal_notes?: string | null;
  } = {
    review_stage: reviewStage,
    status,
  };

  if (typeof internalNotes !== "undefined") {
    updates.internal_notes = internalNotes || null;
  }

  const { error } = await supabase
    .from("affiliate_applications")
    .update(updates)
    .eq("id", applicationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${applicationId}`);
}

export async function updateApplicationReviewAction(
  _previousState: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  await requireAdminUser();

  const applicationId = getFormValue(formData, "applicationId");
  const reviewStage = getFormValue(formData, "review_stage");
  const status = getFormValue(formData, "status");
  const internalNotes = getFormValue(formData, "internal_notes");

  if (!applicationId) {
    return {
      message: "Missing application id.",
      status: "error",
    };
  }

  if (!REVIEW_STAGE_OPTIONS.includes(reviewStage)) {
    return {
      message: "Invalid review stage selected.",
      status: "error",
    };
  }

  if (!APPLICATION_STATUS_OPTIONS.includes(status)) {
    return {
      message: "Invalid application status selected.",
      status: "error",
    };
  }

  try {
    await updateApplicationStageAndStatus({
      applicationId,
      reviewStage,
      status,
      internalNotes,
    });

    return {
      message: "Application review updated.",
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
  await requireAdminUser();

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
  });

  redirect(`/admin/applications/${applicationId}`);
}
