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
      {pending ? "Saving..." : "Save notes"}
    </button>
  );
}

type ReviewUpdateFormProps = {
  applicationId: string;
  currentInternalNotes: string | null;
  action: (
    state: ReviewFormState,
    formData: FormData
  ) => Promise<ReviewFormState>;
};

export function ReviewUpdateForm({
  applicationId,
  currentInternalNotes,
  action,
}: ReviewUpdateFormProps) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <section className="panel admin-update-panel">
      <div className="section-heading">
        <p className="eyebrow">Admin Notes</p>
        <h2>Internal notes</h2>
      </div>

      <form action={formAction} className="admin-update-form">
        <input type="hidden" name="applicationId" value={applicationId} />

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
