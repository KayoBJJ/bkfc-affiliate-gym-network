"use server";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/admin/auth";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
import { LISTING_FIELDS, logoContentType, validateGymControlInput } from "@/lib/integrations/bkfc/gym-control";
import { runGymControlWorker } from "@/lib/integrations/bkfc/gym-control-worker";
import { UUID_V4_PATTERN } from "@/lib/integrations/bkfc/contracts";
export type GymControlFormState = { message: string; status: "idle" | "success" | "error" };
const messages: Record<string, string> = {
  CONTROL_COMMAND_PENDING: "A command is still pending or uncertain. Resolve it before issuing another command.",
  REFRESH_LISTING_REQUIRED: "Refresh BKFC state, review the latest listing, then submit your edit again.",
  PUBLICATION_REQUIRES_APPROVED_AND_PAID: "Publishing requires current EU approval and confirmed paid status.",
  APPLICATION_DELISTED: "This gym has been delisted. Only a state refresh is available.",
  IDEMPOTENCY_CONFLICT: "This command identity was already used. Refresh and review before submitting a new command.",
};
export async function submitGymControlAction(_previous: GymControlFormState, form: FormData): Promise<GymControlFormState> {
  const actor = await requireAdminUser();
  const applicationId = String(form.get("applicationId") ?? "");
  const commandId = String(form.get("commandId") ?? "");
  if (!UUID_V4_PATTERN.test(applicationId) || !UUID_V4_PATTERN.test(commandId)) return { status: "error", message: "Invalid application or command identity. Refresh the page." };
  if (!getBkfcIntegrationConfig().gymControlDeliveryEnabled) return { status: "error", message: "BKFC gym controls are disabled pending coordinated staging readiness." };
  const db = createAdminSupabaseClient();
  const kind = String(form.get("kind") ?? "");
  try {
    if (kind === "resume") {
      const { data, error } = await db.from("bkfc_gym_control_commands").select("command_id").eq("command_id", commandId).eq("application_id", applicationId).maybeSingle();
      if (error || !data) throw new Error("CONTROL_COMMAND_NOT_FOUND");
      const resumed = await db.rpc("retry_bkfc_gym_control", { p_command_id: commandId, p_actor_user_id: actor.id, p_actor_email: actor.email });
      if (resumed.error || resumed.data !== true) throw new Error("CONTROL_NOT_RESUMABLE");
    } else {
      let payload: Record<string, string | boolean | null> = {};
      const version = kind === "edit" || kind === "logo" ? String(form.get("version") ?? "") : null;
      if (kind === "edit") {
        const snapshot = await db.from("bkfc_gym_remote_state").select("state,listing_version").eq("application_id", applicationId).maybeSingle();
        if (snapshot.error || !snapshot.data || snapshot.data.listing_version !== version) throw new Error("REFRESH_LISTING_REQUIRED");
        const listing = snapshot.data.state?.listing ?? {};
        for (const field of LISTING_FIELDS) {
          if (form.has(field) && String(form.get(field) ?? "") !== String(listing[field] ?? "")) payload[field] = String(form.get(field) ?? "");
        }
      } else if (kind === "logo") {
        const file = form.get("logoUpload");
        if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) throw new Error("INVALID_FILE");
        const bytes = Buffer.from(await file.arrayBuffer());
        payload = { base64: bytes.toString("base64"), contentType: logoContentType(bytes) };
      } else if (kind === "visibility") payload = { visible: form.get("visible") === "true", reasonCode: "eu_requested" };
      else if (kind === "cancel_subscription") payload = { cancellationId: commandId, mode: String(form.get("mode")), reasonCode: "eu_requested" };
      else if (kind === "delist") {
        if (form.get("confirmDelist") !== "on") throw new Error("CONFIRM_DELIST_REQUIRED");
        payload = { reasonCode: "eu_requested" };
      }
      validateGymControlInput(kind, payload, version);
      const { error } = await db.rpc("enqueue_bkfc_gym_control", {
        p_command_id: commandId, p_application_id: applicationId, p_command_type: kind,
        p_payload: payload, p_expected_version: version, p_actor_user_id: actor.id, p_actor_email: actor.email,
      });
      if (error) throw new Error(error.message);
    }
    // The immutable command is committed before transmission. A timeout or process crash
    // leaves the same command for the worker, never a newly generated cancellation.
    let outcome = "Command recorded. Refresh to see delivery progress.";
    try {
      const result = await runGymControlWorker(applicationId);
      if (result.disposition === "accepted") outcome = "BKFC confirmed the command. Review the updated state below.";
      else if (result.disposition === "failed") outcome = "BKFC rejected the command. Review its recorded outcome below.";
      else if (result.disposition === "uncertain") outcome = "The outcome is uncertain. New commands are blocked; retry this same command to reconcile it.";
      else if (result.disposition === "retry") outcome = "Delivery is pending. The worker will retry the same command identity.";
    } catch { outcome = "Command recorded; confirmation is pending. Refresh to inspect its durable delivery state."; }
    revalidatePath(`/admin/applications/${applicationId}`);
    return { status: "success", message: outcome };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return { status: "error", message: messages[code] ?? (code === "INVALID_FILE" ? "Choose a JPEG, PNG, WebP, GIF or AVIF image up to 10 MiB." : "Command was not submitted. Check the fields and refresh before trying again.") };
  }
}
