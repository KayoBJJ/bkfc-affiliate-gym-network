"use client";
import type { ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitGymControlAction, type GymControlFormState } from "@/app/admin/applications/[id]/gym-control-actions";
function Submit({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" className="secondary-button" disabled={disabled || pending}>{pending ? "Recording…" : label}</button>;
}
export function GymControlForm({ applicationId, commandId, kind, label, disabled, children }: {
  applicationId: string; commandId: string; kind: string; label: string; disabled: boolean; children?: ReactNode;
}) {
  const [state, action] = useFormState(submitGymControlAction, { status: "idle", message: "" } as GymControlFormState);
  return <form action={action}>
    <input type="hidden" name="applicationId" value={applicationId} />
    <input type="hidden" name="commandId" value={commandId} />
    <input type="hidden" name="kind" value={kind} />
    <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: "1rem 0" }}>{children}</fieldset>
    <Submit label={label} disabled={disabled} />
    {state.message && <p role="status">{state.message}</p>}
  </form>;
}
