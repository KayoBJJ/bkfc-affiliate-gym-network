"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ReviewFormState } from "@/lib/admin/types";

const initialState: ReviewFormState = {
  message: "",
  status: "idle",
};

function PipelineActionButton({
  label,
  pendingLabel,
  tone,
}: {
  label: string;
  pendingLabel: string;
  tone?: "danger";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={`secondary-button admin-pipeline-button${tone === "danger" ? " danger" : ""}`}
      disabled={pending}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function PipelineActionForm({
  applicationId,
  reviewStage,
  status,
  label,
  pendingLabel,
  tone,
  action,
}: {
  applicationId: string;
  reviewStage: string;
  status: string;
  label: string;
  pendingLabel: string;
  tone?: "danger";
  action: (
    state: ReviewFormState,
    formData: FormData,
  ) => Promise<ReviewFormState>;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="admin-pipeline-form">
      <input type="hidden" name="applicationId" value={applicationId} />
      <input type="hidden" name="review_stage" value={reviewStage} />
      <input type="hidden" name="status" value={status} />
      <PipelineActionButton label={label} pendingLabel={pendingLabel} tone={tone} />
      {state.message ? (
        <p
          className={`admin-form-message ${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
