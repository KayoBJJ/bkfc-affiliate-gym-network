"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { InformationLinkFormState } from "@/lib/admin/types";

const initialState: InformationLinkFormState = {
  message: "",
  status: "idle",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-button" disabled={pending}>
      {pending ? "Generating secure link..." : "Generate new replacement link"}
    </button>
  );
}

export function InformationResponseLinkRecovery({
  applicationId,
  requestId,
  action,
}: {
  applicationId: string;
  requestId: string;
  action: (
    state: InformationLinkFormState,
    formData: FormData,
  ) => Promise<InformationLinkFormState>;
}) {
  const [state, formAction] = useFormState(action, initialState);
  return (
    <form action={formAction} className="admin-response-link-recovery">
      <input type="hidden" name="application_id" value={applicationId} />
      <input type="hidden" name="request_id" value={requestId} />
      <p className="admin-timeline-date">
        Replacement links are shown once. Generate a new link if the previous one was
        missed or lost.
      </p>
      <SubmitButton />
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
