import "server-only";

import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { createAdminSupabaseClient } from "@/lib/admin/supabase";
import {
  getApplicantCommunicationConfig, getApplicationPublicUrl, getEmailRouting,
  isApplicantPortalTestApplication,
} from "@/lib/config/server";
import { APPLICANT_PORTAL_VALID_DAYS, hashApplicantPortalToken } from "./applicant-portal";
import {
  deriveApplicantCommunicationPortalToken, notificationPortalReason,
  renderApplicantCommunication, type ApplicantCommunicationTemplate,
  type ApplicantNotificationType,
} from "./applicant-communication";

type ClaimedRow = { outbox_id: string };

function deliveryError(error: unknown) {
  return error instanceof Error && /^[A-Z0-9_]{3,80}$/.test(error.message)
    ? error.message : "COMMUNICATION_DELIVERY_FAILED";
}

export async function runApplicantCommunicationWorker() {
  const config = getApplicantCommunicationConfig();
  if (!config.enabled) throw new Error("APPLICANT_COMMUNICATIONS_DISABLED");
  const supabase = createAdminSupabaseClient();
  const { data: inspected, error: inspectionError } = await supabase.rpc(
    "inspect_affiliate_notification_queue",
  );
  if (inspectionError) throw new Error("COMMUNICATION_QUEUE_UNAVAILABLE");
  if (config.dryRun) {
    return { dryRun: true, eligible: Number(inspected ?? 0), claimed: 0, sent: 0, failed: 0 };
  }
  if (!config.tokenSecret) throw new Error("CONFIG_COMMUNICATION_INVALID");

  const claimToken = randomUUID();
  const { data: claimed, error: claimError } = await supabase.rpc(
    "claim_affiliate_notifications",
    { p_claim_token: claimToken, p_batch_size: config.batchSize },
  );
  if (claimError) throw new Error("COMMUNICATION_CLAIM_FAILED");

  let sent = 0;
  let failed = 0;
  for (const claim of (claimed ?? []) as ClaimedRow[]) {
    try {
      const { data: outbox, error: outboxError } = await supabase
        .from("affiliate_application_notification_outbox")
        .select("id, application_id, audit_event_id, notification_type, template_id")
        .eq("id", claim.outbox_id).eq("claim_token", claimToken).single();
      if (outboxError || !outbox?.template_id) throw new Error("OUTBOX_UNAVAILABLE");

      const [templateResult, applicationResult, auditResult] = await Promise.all([
        supabase.from("affiliate_application_notification_templates").select("*")
          .eq("id", outbox.template_id).in("approval_status", ["approved", "retired"]).single(),
        supabase.from("affiliate_applications")
          .select("application_reference, contact_person, email, gym_name")
          .eq("id", outbox.application_id).single(),
        supabase.from("affiliate_application_audit_events").select("event_type, details")
          .eq("id", outbox.audit_event_id).maybeSingle(),
      ]);
      const template = templateResult.data;
      const application = applicationResult.data;
      if (templateResult.error || applicationResult.error || !template || !application) {
        throw new Error("COMMUNICATION_CONTEXT_UNAVAILABLE");
      }

      let requestSummary = "";
      let requestDeadline = "";
      const details = auditResult.data?.details as Record<string, unknown> | undefined;
      const requestId = typeof details?.information_request_id === "string"
        ? details.information_request_id : null;
      if (requestId) {
        const { data: request } = await supabase
          .from("affiliate_application_information_requests")
          .select("request_summary, expires_at").eq("id", requestId).maybeSingle();
        requestSummary = request?.request_summary ?? "";
        requestDeadline = request?.expires_at
          ? new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" })
              .format(new Date(request.expires_at))
          : "";
      }

      const token = deriveApplicantCommunicationPortalToken(outbox.id, config.tokenSecret);
      const tokenHash = hashApplicantPortalToken(token);
      if (!tokenHash) throw new Error("PORTAL_TOKEN_INVALID");
      const expiresAt = new Date(Date.now() + APPLICANT_PORTAL_VALID_DAYS * 86_400_000).toISOString();
      const { error: portalError } = await supabase.rpc(
        "prepare_affiliate_notification_portal_delivery",
        {
          p_outbox_id: outbox.id, p_claim_token: claimToken, p_token_hash: tokenHash,
          p_expires_at: expiresAt,
          p_delivery_reason: auditResult.data?.event_type === "information_attachment_replacement_requested"
            ? "replacement_required"
            : notificationPortalReason(outbox.notification_type as ApplicantNotificationType),
        },
      );
      if (portalError) throw new Error("PORTAL_DELIVERY_PREPARE_FAILED");

      const rendered = renderApplicantCommunication({
        template: template as ApplicantCommunicationTemplate,
        variables: {
          contact_person: application.contact_person, gym_name: application.gym_name,
          application_reference: application.application_reference ?? outbox.application_id,
          request_summary: requestSummary, request_deadline: requestDeadline,
        },
        portalUrl: new URL(`/application-progress/${token}`, `${getApplicationPublicUrl()}/`).toString(),
      });
      const routing = getEmailRouting(application.email);
      if (!routing.applicantDeliveryEnabled &&
        !isApplicantPortalTestApplication(application.application_reference ?? "")) {
        throw new Error("PORTAL_TEST_APPLICATION_NOT_ALLOWED");
      }
      if (!routing.providerApiKey || !routing.applicant.enabled ||
        !routing.applicant.from || !routing.applicant.recipient) {
        throw new Error(routing.applicant.skipCode ?? "CONFIG_EMAIL_INVALID");
      }
      const result = await new Resend(routing.providerApiKey).emails.send({
        from: routing.applicant.from, to: routing.applicant.recipient,
        ...(routing.applicant.replyTo ? { replyTo: routing.applicant.replyTo } : {}),
        subject: `${routing.subjectPrefix}${rendered.subject}`, html: rendered.html,
      }, { idempotencyKey: `bkfc-outbox-${outbox.id}` });
      if (result.error) throw new Error("PROVIDER_REJECTED");
      const { error: completionError } = await supabase.rpc(
        "complete_affiliate_notification_delivery",
        {
          p_outbox_id: outbox.id, p_claim_token: claimToken, p_succeeded: true,
          p_provider_message_id: result.data?.id ?? null, p_error_code: null,
        },
      );
      if (completionError) throw new Error("COMMUNICATION_COMPLETION_FAILED");
      sent += 1;
    } catch (error) {
      failed += 1;
      await supabase.rpc("complete_affiliate_notification_delivery", {
        p_outbox_id: claim.outbox_id, p_claim_token: claimToken, p_succeeded: false,
        p_provider_message_id: null, p_error_code: deliveryError(error),
      });
    }
  }
  return {
    dryRun: false, eligible: Number(inspected ?? 0), claimed: (claimed ?? []).length,
    sent, failed,
  };
}
