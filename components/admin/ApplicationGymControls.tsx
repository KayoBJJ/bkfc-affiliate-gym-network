import styles from "./GymControls.module.css";
import { randomUUID } from "node:crypto";
import type { getGymControlStatus } from "@/lib/admin/supabase";
import { GymControlForm } from "./GymControlForm";
import { LISTING_FIELDS, type GymState } from "@/lib/integrations/bkfc/gym-control";
import { formatLabel } from "@/lib/admin/formatLabel";
export function ApplicationGymControls({ applicationId, controls, enabled }: {
  applicationId: string; controls: Awaited<ReturnType<typeof getGymControlStatus>>; enabled: boolean;
}) {
  if (!controls) return null;
  if (!controls.available) return <section className={`panel admin-detail-panel ${styles.controls}`}><h2>BKFC listing controls</h2><p>Control persistence is unavailable. Apply the reviewed migration before enabling this panel.</p></section>;
  const remote = controls.remote;
  const state = remote?.state as GymState | undefined;
  const unresolved = controls.commands.find(c => ["queued", "sending", "retry_wait", "uncertain"].includes(c.delivery_status));
  const disabled = !enabled || !!unresolved;
  const mutationDisabled = disabled || !!remote?.delisted;
  const base = { applicationId, disabled: mutationDisabled };
  const timestamp = (value: string | null | undefined) => value ? new Date(value).toISOString() : "Not confirmed";
  return <section className={`panel admin-detail-panel ${styles.controls}`}>
    <p className="eyebrow">BKFC gym controls</p><h2>Public listing and subscription</h2>
    {!enabled && <p>Delivery is disabled pending coordinated staging readiness.</p>}
    <div className="admin-detail-grid">
      <div><p className="admin-detail-label">Public visibility</p><p>{remote?.confirmed_visible === true ? "Visible — confirmed by BKFC" : remote?.confirmed_visible === false ? "Hidden — confirmed by BKFC" : "Unknown — refresh BKFC state"}</p></div>
      <div><p className="admin-detail-label">Visibility confirmed at</p><p>{timestamp(remote?.visibility_confirmed_at)}</p></div>
      <div><p className="admin-detail-label">BKFC subscription snapshot</p><p>{state?.subscription.status ?? "Unknown"}</p></div>
      <div><p className="admin-detail-label">Paid period ends</p><p>{timestamp(state?.subscription.currentPeriodEnd)}</p></div>
      <div><p className="admin-detail-label">Cancellation requested</p><p>{remote?.cancellation_requested_mode ? formatLabel(remote.cancellation_requested_mode) + " — wait for subscription-ended callback" : state?.subscription.cancelAtPeriodEnd ? "At period end" : "None confirmed"}</p></div>
      <div><p className="admin-detail-label">BKFC delivery to EU</p><p>{state ? `${state.euDelivery.acknowledged ? "Acknowledged" : "Not acknowledged"} · ${state.euDelivery.attempts} attempts · ${state.euDelivery.lastError ?? "No error reported"}` : "Unknown"}</p></div>
      <div><p className="admin-detail-label">BKFC state read at</p><p>{timestamp(remote?.observed_at)}</p></div>
    </div>
    <p>EU activation and public visibility are separate. Billing callbacks do not publish, hide, or restore a gym.</p>
    {unresolved && <p role="status">{formatLabel(unresolved.delivery_status)}: {formatLabel(unresolved.command_type)}. Resolve this command before sending a newer decision.</p>}
    <GymControlForm {...base} disabled={disabled} commandId={randomUUID()} kind="read" label="Refresh BKFC state" />
    <details><summary>Edit listing</summary>
      <p>Refresh state first. If another edit has landed, refresh and review your changes again.</p>
      <GymControlForm {...base} disabled={mutationDisabled || !remote?.listing_version} commandId={randomUUID()} kind="edit" label="Save listing edits">
        <input type="hidden" name="version" value={remote?.listing_version ?? ""} />
        <div className="admin-detail-grid">{LISTING_FIELDS.map(field => <label key={`${remote?.listing_version}-${field}`}>{field.replace(/([A-Z])/g," $1")}<input name={field} maxLength={1000} defaultValue={String(state?.listing[field] ?? "")} /></label>)}</div>
      </GymControlForm>
      <GymControlForm {...base} disabled={mutationDisabled || !remote?.listing_version} commandId={randomUUID()} kind="logo" label="Replace logo">
        <input type="hidden" name="version" value={remote?.listing_version ?? ""} />
        <label>Logo image (up to 10 MiB)<input type="file" name="logoUpload" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" required /></label>
      </GymControlForm>
    </details>
    <GymControlForm {...base} commandId={randomUUID()} kind="visibility" label="Set visibility">
      <label>Public listing<select name="visible"><option value="false">Hidden</option><option value="true">Visible (requires approved and paid)</option></select></label>
    </GymControlForm>
    <details><summary>Subscription cancellation and delisting</summary>
      <p>Cancellation does not hide the listing. Use visibility separately. End-of-period cancellation retains the paid period; immediate cancellation ends the subscription now.</p>
      <GymControlForm {...base} commandId={randomUUID()} kind="cancel_subscription" label="Request subscription cancellation">
        <label>When<select name="mode"><option value="at_period_end">At the end of the paid period</option><option value="immediately">Immediately</option></select></label>
      </GymControlForm>
      <GymControlForm {...base} commandId={randomUUID()} kind="delist" label="Delist gym">
        <label><input type="checkbox" name="confirmDelist" required /> Permanently delist: cancel the subscription immediately, hide the gym and archive its listing.</label>
      </GymControlForm>
    </details>
    <GymControlForm {...base} commandId={randomUUID()} kind="retry_deliveries" label="Requeue parked BKFC deliveries" />
    <p>Parked-delivery recovery requires coordination with BKFC on event order. Retryable backoff recovers separately.</p>
    {unresolved?.delivery_status === "uncertain" && <GymControlForm {...base} disabled={!enabled} commandId={unresolved.command_id} kind="resume" label="Reconcile by retrying the same command" />}
    <h3>Recent command outcomes</h3>
    {controls.commands.length === 0 ? <p>No control commands recorded.</p> : <ul>{controls.commands.map(command => <li key={command.command_id}>
      {formatLabel(command.command_type)} — {formatLabel(command.delivery_status)}; {command.last_code ?? "awaiting delivery"}. Attempts: {command.total_attempt_count}.<br />
      <small>{command.command_id}{command.next_attempt_at ? ` · Next attempt ${timestamp(command.next_attempt_at)}` : ""}</small>
    </li>)}</ul>}
  </section>;
}
