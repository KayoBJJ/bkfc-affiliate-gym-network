"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ReviewFormState } from "@/lib/admin/types";

const initialState: ReviewFormState = {
  message: "",
  status: "idle",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="cta-button admin-submit-button" disabled={pending}>
      {pending ? "Saving..." : "Save review update"}
    </button>
  );
}

type ReviewUpdateFormProps = {
  applicationId: string;
  currentStatus: string;
  currentReviewStage: string;
  currentInternalNotes: string | null;
  reviewStageOptions: string[];
  statusOptions: string[];
  action: (
    state: ReviewFormState,
    formData: FormData
  ) => Promise<ReviewFormState>;
};

export function ReviewUpdateForm({
  applicationId,
  currentStatus,
  currentReviewStage,
  currentInternalNotes,
  reviewStageOptions,
  statusOptions,
  action,
}: ReviewUpdateFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <section className="panel admin-update-panel">
      <div className="section-heading">
        <p className="eyebrow">Review Update</p>
        <h2>Admin actions</h2>
      </div>

      <form action={formAction} className="admin-update-form">
        <input type="hidden" name="applicationId" value={applicationId} />

        <label className="admin-field">
          <span>Review stage</span>
          <select name="review_stage" defaultValue={currentReviewStage}>
            {reviewStageOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Status</span>
          <select name="status" defaultValue={currentStatus}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-field">
          <span>Internal notes</span>
          <textarea
            name="internal_notes"
            defaultValue={currentInternalNotes ?? ""}
            rows={8}
            placeholder="Add internal review notes, follow-up context, or next actions."
          />
        </label>

        <SubmitButton />

        {state.message ? (
          <p className={`admin-form-message ${state.status}`}>{state.message}</p>
        ) : null}
      </form>
    </section>
  );
}

