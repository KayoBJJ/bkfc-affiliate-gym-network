"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ApplicantPortalLinkFormState } from "@/lib/admin/types";

const initialState: ApplicantPortalLinkFormState = {
  message: "",
  status: "idle",
};

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="secondary-button admin-submit-button" disabled={pending}>
      {pending ? "Generating portal..." : "Generate applicant portal link"}
    </button>
  );
}

function EmailButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cta-button admin-submit-button" disabled={pending}>
      {pending ? "Sending secure email..." : "Email secure portal access"}
    </button>
  );
}

export function ApplicantPortalAccessCard({
  applicationId,
  generateAction,
  emailAction,
}: {
  applicationId: string;
  generateAction: (
    state: ApplicantPortalLinkFormState,
    formData: FormData,
  ) => Promise<ApplicantPortalLinkFormState>;
  emailAction: (
    state: ApplicantPortalLinkFormState,
    formData: FormData,
  ) => Promise<ApplicantPortalLinkFormState>;
}) {
  const [generateState, generateFormAction] = useFormState(generateAction, initialState);
  const [emailState, emailFormAction] = useFormState(emailAction, initialState);
  return (
    <section className="panel admin-portal-access-card">
      <div className="section-heading">
        <p className="eyebrow">Applicant Access</p>
        <h2>Progress portal</h2>
      </div>
      <p>
        Send a private portal link through the approved applicant email route, or
        generate a one-time admin test link. Only successful email delivery
        replaces the applicant&apos;s current link.
      </p>
      <form action={emailFormAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <EmailButton />
      </form>
      {emailState.message ? (
        <p className={`admin-form-message ${emailState.status}`} role="status">
          {emailState.message}
        </p>
      ) : null}
      <form action={generateFormAction}>
        <input type="hidden" name="application_id" value={applicationId} />
        <GenerateButton />
      </form>
      {generateState.message ? (
        <p className={`admin-form-message ${generateState.status}`} role="status">
          {generateState.message}
        </p>
      ) : null}
      {generateState.portalPath ? (
        <a
          className="cta-button admin-response-link"
          href={generateState.portalPath}
          target="_blank"
          rel="noreferrer"
        >
          Open new portal link
        </a>
      ) : null}
    </section>
  );
}
