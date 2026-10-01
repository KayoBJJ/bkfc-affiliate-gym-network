import "server-only";
import { buildApplicantReceivedEmail } from "./received-email";
import { getReceivedEmailAttachments } from "./email-brand-assets";
import { Resend } from "resend";
import { logApplicationEvent } from "./logging";
import { getEmailRouting, isApplicantCommunicationsEnabled } from "@/lib/config/server";
import {
  isApplicantPortalEmailDeliveryEnabled,
  isApplicantPortalEnabled,
} from "@/lib/config/server";
import {
  completeApplicantPortalDelivery,
  prepareApplicantPortalDelivery,
  type PreparedApplicantPortalDelivery,
} from "./applicant-portal-delivery";
import type { ApplicantPortalEmailOutcome } from "./applicant-portal-email";
import { isApplicantPortalDeliveryTargetAllowed } from "./applicant-portal-email";
import {
  buildInternalNotificationEmail,
  type EmailApplication,
} from "./email-content";

export async function sendApplicationNotifications(application: EmailApplication) {
  const routing = getEmailRouting(application.email);
  const applicantCommunicationsEnabled = isApplicantCommunicationsEnabled();
  const sends: Array<{ type: "internal" | "applicant"; promise: ReturnType<Resend["emails"]["send"]> }> = [];
  let preparedPortal: PreparedApplicantPortalDelivery | null = null;
  if (
    applicantCommunicationsEnabled &&
    isApplicantPortalEnabled() &&
    isApplicantPortalEmailDeliveryEnabled() &&
    isApplicantPortalDeliveryTargetAllowed(application)
  ) {
    try {
      preparedPortal = await prepareApplicantPortalDelivery({
        applicationId: application.applicationId,
        reason: "application_received",
      });
    } catch {
      logApplicationEvent("warn", {
        stage: "notification",
        code: "PORTAL_DELIVERY_PREPARE_FAILED",
        applicationReference: application.applicationReference,
        notification: "failed",
        notificationType: "applicant_portal",
      });
    }
  }

  if (!routing.internal.enabled) {
    logApplicationEvent("warn", {
      stage: "notification",
      code: routing.internal.skipCode ?? "INTERNAL_NOTIFICATION_SKIPPED",
      applicationReference: application.applicationReference,
      notification: "skipped",
      notificationType: "internal",
    });
  }
  if (!applicantCommunicationsEnabled || !routing.applicant.enabled) {
    logApplicationEvent("warn", {
      stage: "notification",
      code: applicantCommunicationsEnabled
        ? routing.applicant.skipCode ?? "EMAIL_TEST_DELIVERY_SKIPPED"
        : "APPLICANT_COMMUNICATIONS_DISABLED",
      applicationReference: application.applicationReference,
      notification: "skipped",
      notificationType: "applicant_template",
    });
  }

  if (!routing.providerApiKey) {
    if (preparedPortal) {
      await completeApplicantPortalDelivery({
        accessId: preparedPortal.accessId,
        outcome: { status: "failed", errorCode: "CONFIG_EMAIL_INVALID" },
      }).catch(() => undefined);
    }
    return;
  }
  const resend = new Resend(routing.providerApiKey);
  if (routing.internal.enabled && routing.internal.from && routing.internal.recipient) {
    sends.push({
      type: "internal",
      promise: resend.emails.send({
        from: routing.internal.from,
        to: routing.internal.recipient,
        subject: `New BKFC Affiliate Gym Application: ${application.applicationReference}`,
        html: buildInternalNotificationEmail(application),
      }),
    });
  }
  if (
    applicantCommunicationsEnabled &&
    routing.applicant.enabled &&
    routing.applicant.from &&
    routing.applicant.recipient
  ) {
    const applicantFrom = routing.applicant.from;
    const applicantRecipient = routing.applicant.recipient;
    sends.push({
      type: "applicant",
      promise: Promise.resolve().then(() => resend.emails.send({
        from: applicantFrom,
        to: applicantRecipient,
        ...(routing.applicant.replyTo ? { replyTo: routing.applicant.replyTo } : {}),
        subject: `${routing.subjectPrefix}BKFC Gym Network — Application Received`,
        attachments: getReceivedEmailAttachments(),
        html: buildApplicantReceivedEmail({
          gymNetworkUrl: process.env.GYM_NETWORK_EMAIL_URL,
          privacyUrl: process.env.GYM_NETWORK_EMAIL_PRIVACY_URL,
          termsUrl: process.env.GYM_NETWORK_EMAIL_TERMS_URL,
          contactPerson: application.contactPerson,
          gymName: application.gymName,
          cityCountry: application.cityCountry,
          submissionId: application.applicationReference,
          ...(preparedPortal ? { portalUrl: preparedPortal.portalUrl } : {}),
        }),
      })),
    });
  }

  const results = await Promise.allSettled(sends.map(({ promise }) => promise));
  let applicantOutcome: ApplicantPortalEmailOutcome = {
    status: "failed",
    errorCode: "APPLICANT_EMAIL_NOT_SENT",
  };
  results.forEach((result, index) => {
    const failed = result.status === "rejected" || Boolean(result.value.error);
    if (sends[index].type === "applicant") {
      applicantOutcome = failed
        ? { status: "failed", errorCode: "PROVIDER_REJECTED" }
        : {
            status: "sent",
            providerMessageId:
              result.status === "fulfilled" ? result.value.data?.id ?? null : null,
          };
    }
    logApplicationEvent(failed ? "warn" : "info", {
      stage: "notification",
      code: failed ? "EMAIL_NOTIFICATION_FAILED" : "EMAIL_NOTIFICATION_SENT",
      applicationReference: application.applicationReference,
      notification: failed ? "failed" : "sent",
      notificationType: sends[index].type === "internal" ? "internal" : "applicant_template",
    });
  });
  if (preparedPortal) {
    try {
      await completeApplicantPortalDelivery({
        accessId: preparedPortal.accessId,
        outcome: applicantOutcome,
      });
    } catch {
      logApplicationEvent("warn", {
        stage: "notification",
        code: "PORTAL_DELIVERY_FINALIZE_FAILED",
        applicationReference: application.applicationReference,
        notification: "failed",
        notificationType: "applicant_portal",
      });
    }
  }
}
