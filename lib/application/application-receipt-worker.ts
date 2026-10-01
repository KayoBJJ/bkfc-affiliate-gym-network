import "server-only";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import { resolveReceiptConfig, resolveReceiptRouting } from "./receipt-policy";
import { buildApplicantReceivedEmail } from "./received-email";
import { getReceivedEmailAttachments } from "./email-brand-assets";
import { deliverReceiptBatch } from "./receipt-delivery";

export async function runApplicationReceiptWorker() {
  const config = resolveReceiptConfig(process.env);
  if (!config.enabled) {
    throw new Error("APPLICATION_RECEIPTS_DISABLED");
  }
  // Test mode filters before claiming so other gyms never consume attempts.
  if (!config.dryRun) {
    const preflight = resolveReceiptRouting("receipt-config-check@example.invalid", process.env);
    if (!preflight.providerApiKey || !preflight.applicant.enabled) throw new Error("CONFIG_EMAIL_INVALID");
  }
  const scope = { p_application_reference: config.mode === "test" ? config.testReference : null };
  const supabase = createAdminSupabaseClient();
  const { data: eligible, error: inspectError } = await supabase.rpc("inspect_affiliate_receipt_queue", scope);
  if (inspectError) throw new Error("RECEIPT_QUEUE_UNAVAILABLE");
  if (config.dryRun) return { dryRun: true, eligible: Number(eligible ?? 0), claimed: 0, sent: 0, failed: 0 };
  const claimToken = randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc("claim_affiliate_receipts", {
    p_claim_token: claimToken, p_batch_size: config.batchSize, ...scope,
  });
  if (claimError) throw new Error("RECEIPT_CLAIM_FAILED");
  const ids = ((claimed ?? []) as { outbox_id: string }[]).map(row => row.outbox_id);
  const summary = await deliverReceiptBatch(ids, async id => {
    const { data: outbox, error } = await supabase.from("affiliate_application_notification_outbox")
      .select("application_id").eq("id", id).eq("claim_token", claimToken)
      .eq("notification_type", "application_received").eq("delivery_status", "sending").single();
    if (error || !outbox) throw new Error("RECEIPT_CONTEXT_UNAVAILABLE");
    const { data: application, error: applicationError } = await supabase.from("affiliate_applications")
      .select("application_reference, contact_person, email, gym_name, city_country")
      .eq("id", outbox.application_id).eq("source_system", "bkfc").single();
    if (applicationError || !application) throw new Error("RECEIPT_CONTEXT_UNAVAILABLE");
    const routing = resolveReceiptRouting(application.email, process.env);
    if (!routing.applicantDeliveryEnabled && (application.application_reference ?? "").toUpperCase() !== config.testReference?.toUpperCase()) {
      throw new Error("RECEIPT_TEST_APPLICATION_NOT_ALLOWED");
    }
    if (!routing.providerApiKey || !routing.applicant.enabled || !routing.applicant.from || !routing.applicant.recipient) {
      throw new Error("CONFIG_EMAIL_INVALID");
    }
    const result = await new Resend(routing.providerApiKey).emails.send({
      from: routing.applicant.from, to: routing.applicant.recipient,
      replyTo: routing.applicant.replyTo ?? "bkfcgym@bkfc.com",
      subject: `${routing.subjectPrefix}BKFC Gym Network — Application Received`,
      attachments: getReceivedEmailAttachments(),
      html: buildApplicantReceivedEmail({
        contactPerson: application.contact_person, gymName: application.gym_name,
        cityCountry: application.city_country,
        submissionId: application.application_reference ?? outbox.application_id,
        gymNetworkUrl: process.env.GYM_NETWORK_EMAIL_URL,
        privacyUrl: process.env.GYM_NETWORK_EMAIL_PRIVACY_URL,
        termsUrl: process.env.GYM_NETWORK_EMAIL_TERMS_URL,
      }),
    }, { idempotencyKey: `bkfc-outbox-${id}` });
    if (result.error || !result.data?.id) throw new Error("PROVIDER_REJECTED");
    return result.data.id;
  }, async (id, outcome) => {
    const { error } = await supabase.rpc("complete_affiliate_receipt_delivery", {
      p_outbox_id: id, p_claim_token: claimToken, p_succeeded: outcome.errorCode === null,
      p_provider_message_id: outcome.providerMessageId, p_error_code: outcome.errorCode,
    });
    if (error) throw new Error("RECEIPT_COMPLETION_FAILED");
  });
  return { dryRun: false, eligible: Number(eligible ?? 0), claimed: ids.length, ...summary };
}
