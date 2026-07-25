"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ApplicantPortalLinkFormState } from "@/lib/admin/types";

const initialState: ApplicantPortalLinkFormState = {
  message: "",
  status: "idle",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-button admin-submit-button" disabled={pending}>
      {pending ? "Generating portal..." : "Generate applicant portal link"}
    </button>
  );
}

export function ApplicantPortalAccessCard({
  applicationId,
  action,
}: {
  applicationId: string;
  action: (
    state: ApplicantPortalLinkFormState,
    formData: FormData,
  ) => Promise<ApplicantPortalLinkFormState>;
}) {
  const [state, formAction] = useFormState(action, initialState);
  return (
    <section className="panel admin-portal-access-card">
      <div className="section-heading">
        <p className="eyebrow">Applicant Access</p>
        <h2>Progress portal</h2>
      </div>
      <p>
        Create a private progress link for this applicant. Generating a new link
        immediately invalidates the previous one.
      </p>
      <form action={formAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <SubmitButton />
      </form>
      {state.message ? (
        <p className={`admin-form-message ${state.status}`} role="status">
          {state.message}
        </p>
      ) : null}
      {state.portalPath ? (
        <a
          className="cta-button admin-response-link"
          href={state.portalPath}
          target="_blank"
          rel="noreferrer"
        >
          Open new portal link
        </a>
      ) : null}
    </section>
  );
}

