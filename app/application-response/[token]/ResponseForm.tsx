"use client";

import { useFormState, useFormStatus } from "react-dom";
import type {
  InformationResponseState,
} from "./actions";

const initialState: InformationResponseState = {
  message: "",
  status: "idle",
};

function SubmitButton({ completed }: { completed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="cta-button" disabled={pending || completed}>
      {pending ? "Submitting securely..." : completed ? "Response received" : "Submit response"}
    </button>
  );
}

type Props = {
  token: string;
  action: (
    state: InformationResponseState,
    formData: FormData
  ) => Promise<InformationResponseState>;
};

export function ResponseForm({ token, action }: Props) {
  const [state, formAction] = useFormState(action, initialState);
  const completed = state.status === "success";

  return (
    <form action={formAction} className="response-form">
      <input type="hidden" name="token" value={token} />
      <label className="admin-field">
        <span>Your response</span>
        <textarea
          name="response_text"
          rows={10}
          maxLength={6000}
          required
          disabled={completed}
          placeholder="Provide the requested information as clearly as possible."
        />
      </label>
      <SubmitButton completed={completed} />
      {state.message ? (
        <p className={`admin-form-message ${state.status}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
