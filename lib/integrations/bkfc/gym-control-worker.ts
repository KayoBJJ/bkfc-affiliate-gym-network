import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
import { deliverGymControl, type GymControlCommand } from "./gym-control";

export async function runGymControlWorker(applicationId?: string) {
  const config = getBkfcIntegrationConfig();
  if (!config.gymControlDeliveryEnabled || !config.paymentRequestBaseUrl || !config.euToBkfcCurrentSecret) throw new Error("GYM_CONTROL_DELIVERY_DISABLED");
  const db = createAdminSupabaseClient();
  const token = randomUUID();
  const { data, error } = await db.rpc("claim_bkfc_gym_control", { p_claim_token: token, p_application_id: applicationId ?? null });
  if (error) throw new Error("CONTROL_CLAIM_FAILED");
  const command = (data as GymControlCommand[] | null)?.[0];
  if (!command) return { processed: 0 };
  const result = await deliverGymControl(command, { baseUrl: config.paymentRequestBaseUrl, bearerSecret: config.euToBkfcCurrentSecret });
  const completion = await db.rpc("complete_bkfc_gym_control", {
    p_command_id: command.command_id, p_claim_token: token, p_disposition: result.disposition,
    p_request_id: result.requestId, p_http_status: result.httpStatus, p_code: result.code,
    p_next_attempt_at: result.nextAttemptAt, p_state: result.state,
  });
  if (completion.error) throw new Error("CONTROL_COMPLETION_UNKNOWN");
  return { processed: 1, disposition: result.disposition };
}
