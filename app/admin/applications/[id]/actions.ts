"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { APPLICATION_STATUS_OPTIONS, REVIEW_STAGE_OPTIONS } from "@/lib/admin/constants";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { logStageChange } from "@/lib/admin/stageHistory";
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
  const { data: existingApplication, error: existingApplicationError } = await supabase
    .from("affiliate_applications")
    .select("review_stage")
    .eq("id", applicationId)
    .maybeSingle();

  if (existingApplicationError) {
    throw new Error(existingApplicationError.message);
  }

  if (!existingApplication) {
    throw new Error("Application not found.");
  }

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

  if (existingApplication.review_stage !== reviewStage) {
    await logStageChange(applicationId, reviewStage, status);
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
  const internalNotes = getFormValue(formData, "internal_notes");

  if (!applicationId) {
    return {
      message: "Missing application id.",
      status: "error",
    };
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
      .from("affiliate_applications")
      .update({
        internal_notes: internalNotes || null,
      })
      .eq("id", applicationId);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/applications");
    revalidatePath(`/admin/applications/${applicationId}`);

    return {
      message: "Notes updated.",
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
