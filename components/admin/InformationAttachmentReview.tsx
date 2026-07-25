"use client";

import { useFormState, useFormStatus } from "react-dom";
import type {
  ApplicationInformationAttachment,
  AttachmentReviewFormState,
} from "@/lib/admin/types";

const initialState: AttachmentReviewFormState = {
  message: "",
  status: "idle",
};

function ReviewButtons() {
  const { pending } = useFormStatus();
  return (
    <div className="admin-attachment-review-actions">
      <button
        type="submit"
        name="decision"
        value="accepted"
        className="secondary-button"
        disabled={pending}
      >
        Accept file
      </button>
      <button
        type="submit"
        name="decision"
        value="replacement_requested"
        className="secondary-button"
        disabled={pending}
      >
        Request replacement
      </button>
    </div>
  );
}

export function InformationAttachmentReview({
  applicationId,
  attachment,
  action,
}: {
  applicationId: string;
  attachment: ApplicationInformationAttachment;
  action: (
    state: AttachmentReviewFormState,
    formData: FormData,
  ) => Promise<AttachmentReviewFormState>;
}) {
  const [state, formAction] = useFormState(action, initialState);
  if (attachment.status !== "uploaded") {
    return state.responsePath ? (
      <div className="admin-attachment-review-form">
        <p className={`admin-form-message ${state.status}`}>{state.message}</p>
        <a
          className="secondary-button admin-response-link"
          href={state.responsePath}
          target="_blank"
          rel="noreferrer"
        >
          Open one-time replacement link
        </a>
      </div>
    ) : null;
  }

  return (
    <form action={formAction} className="admin-attachment-review-form">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="attachment_id" value={attachment.id} />
      <label className="admin-field">
        <span>Replacement instructions</span>
        <textarea
          name="review_note"
          rows={3}
          maxLength={1000}
          placeholder="Required only when requesting a replacement."
        />
      </label>
      <ReviewButtons />
      {state.message ? (
        <p className={`admin-form-message ${state.status}`}>{state.message}</p>
      ) : null}
      {state.responsePath ? (
        <a
          className="secondary-button admin-response-link"
          href={state.responsePath}
          target="_blank"
          rel="noreferrer"
        >
          Open one-time replacement link
        </a>
      ) : null}
    </form>
  );
}
