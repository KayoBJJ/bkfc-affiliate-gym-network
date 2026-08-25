import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { getBkfcIntegrationConfig } from "@/lib/config/server";
import { safeIntegrationLog } from "./http";
import { deliverPaymentCommand, type PaymentCommand } from "./payment-command-transport";

export async function runPaymentCommandWorker(fetchImpl: typeof fetch = fetch) {
  const config = getBkfcIntegrationConfig();
  if (!config.paymentDeliveryEnabled || !config.euToBkfcCurrentSecret || !config.paymentRequestBaseUrl) {
    throw new Error("PAYMENT_DELIVERY_DISABLED");
  }
  const supabase = createAdminSupabaseClient();
  const claimToken = randomUUID();
  const { data, error } = await supabase.rpc("claim_affiliate_payment_command_delivery", {
    p_claim_token: claimToken,
    p_batch_size: 5,
    p_lease_seconds: 900,
  });
  if (error) throw new Error("PAYMENT_COMMAND_CLAIM_FAILED");
  const commands = (data ?? []) as PaymentCommand[];
  let accepted = 0;
  let retrying = 0;
  let interventionRequired = 0;
  let suppressed = 0;
  for (const command of commands) {
    try {
      if (command.command_type === "payment_initiation") {
        const { data: mayTransmit, error: checkError } = await supabase.rpc(
          "confirm_affiliate_payment_command_transmission",
          { p_command_id: command.command_id, p_claim_token: claimToken },
        );
        if (checkError) throw new Error("PAYMENT_COMMAND_RECHECK_FAILED");
        if (mayTransmit !== true) {
          suppressed += 1;
          continue;
        }
      }
      const result = await deliverPaymentCommand(command, {
        baseUrl: config.paymentRequestBaseUrl,
        bearerSecret: config.euToBkfcCurrentSecret,
      }, fetchImpl);
      const { error: completionError } = await supabase.rpc(
        "complete_affiliate_payment_command_delivery",
        {
          p_command_id: command.command_id,
          p_claim_token: claimToken,
          p_disposition: result.disposition,
          p_request_id: result.requestId,
          p_http_status: result.httpStatus,
          p_error_code: result.errorCode,
          p_next_attempt_at: result.nextAttemptAt,
          p_outcome: result.outcome,
        },
      );
      if (completionError) throw new Error("PAYMENT_COMMAND_COMPLETION_FAILED");
      if (result.disposition === "accepted") accepted += 1;
      else if (result.disposition === "retry") retrying += 1;
      else interventionRequired += 1;
      safeIntegrationLog({ stage: "payment_delivery", code: `COMMAND_${result.disposition.toUpperCase()}`, commandId: command.command_id, applicationId: command.application_id, requestId: result.requestId, attemptCount: command.attempt_count });
    } catch {
      interventionRequired += 1;
      safeIntegrationLog({ stage: "payment_delivery", code: "COMMAND_PROCESSING_FAILED", commandId: command.command_id, applicationId: command.application_id });
    }
  }
  return { claimed: commands.length, accepted, retrying, interventionRequired, suppressed };
}
