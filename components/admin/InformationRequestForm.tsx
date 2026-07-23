"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { InformationRequestFormState } from "@/lib/admin/types";

const initialState: InformationRequestFormState = {
  message: "",
  status: "idle",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cta-button admin-submit-button" disabled={pending}>
      {pending ? "Creating secure request..." : "Create secure follow-up request"}
    </button>
  );
}

type Props = {
  applicationId: string;
  action: (
    state: InformationRequestFormState,
    formData: FormData
  ) => Promise<InformationRequestFormState>;
};

export function InformationRequestForm({ applicationId, action }: Props) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <section className="panel admin-update-panel">
      <div className="section-heading">
        <p className="eyebrow">Applicant Follow-Up</p>
        <h2>Request information</h2>
      </div>

      <form action={formAction} className="admin-update-form">
        <input type="hidden" name="applicationId" value={applicationId} />
        <label className="admin-field">
          <span>Request summary</span>
          <input
            name="request_summary"
            maxLength={500}
            required
            placeholder="Example: Updated coaching credentials and fighter roster"
          />
        </label>
        <label className="admin-field">
          <span>Detailed instructions</span>
          <textarea
            name="request_details"
            maxLength={4000}
            rows={6}
            placeholder="Explain exactly what the applicant should provide."
          />
        </label>
        <label className="admin-field">
          <span>Response link validity</span>
          <select name="valid_days" defaultValue="7">
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </label>
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
            Open one-time test response link
          </a>
        ) : null}
      </form>
    </section>
  );
}
