import { APPLICATION_STATUS_OPTIONS, REVIEW_STAGE_OPTIONS } from "./constants.ts";
import type { ReviewFormState } from "./types.ts";
import { IDEMPOTENCY_KEY_PATTERN } from "../application/policy.ts";

export const PIPELINE_WORKFLOW_MIGRATION_REQUIRED_MESSAGE =
  "Batch 1A.3 database migration is required before workflow actions can be used.";

const ACTIVATION_PAYMENT_GUARD = "ACTIVATION_REQUIRES_APPROVED_AND_PAID";

export function validatePipelineActionInput({
  applicationId,
  reviewStage,
  status,
}: {
  applicationId: string;
  reviewStage: string;
  status: string;
}): ReviewFormState | null {
  if (!IDEMPOTENCY_KEY_PATTERN.test(applicationId)) {
    return { message: "Invalid application id.", status: "error" };
  }
  if (!REVIEW_STAGE_OPTIONS.includes(reviewStage)) {
    return { message: "Invalid review stage selected.", status: "error" };
  }
  if (!APPLICATION_STATUS_OPTIONS.includes(status)) {
    return { message: "Invalid application status selected.", status: "error" };
  }
  return null;
}

export function pipelineActionErrorState(error: unknown): ReviewFormState {
  const message = error instanceof Error ? error.message : "";

  if (message.includes(ACTIVATION_PAYMENT_GUARD)) {
    return {
      message: "This affiliate cannot be activated until BKFC confirms payment.",
      status: "error",
    };
  }
  if (message === PIPELINE_WORKFLOW_MIGRATION_REQUIRED_MESSAGE) {
    return { message, status: "error" };
  }
  return {
    message: "Unable to update the application workflow.",
    status: "error",
  };
}
