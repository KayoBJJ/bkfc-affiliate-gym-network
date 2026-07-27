import "server-only";
import { Resend } from "resend";
import { logApplicationEvent } from "./logging";
import { getEmailRouting } from "@/lib/config/server";
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
  escapeHtml,
  type EmailApplication,
} from "./email-content";

function buildApplicantReceivedEmail({
  contactPerson,
  gymName,
  cityCountry,
  submissionId,
  portalUrl,
}: {
  contactPerson: string;
  gymName: string;
  cityCountry: string;
  submissionId: string;
  portalUrl?: string;
}) {
  return `
<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr>
      <td align="center">

        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111111;border:1px solid #262626;border-radius:14px;overflow:hidden;">

          <tr>
            <td style="background:#c8a45d;padding:14px 24px;">
              <div style="margin:0;color:#000000;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">
                BKFC Gym Network
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 18px;background:#111111;">
              <div style="display:inline-block;margin:0 0 16px;padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c8a45d;background:#1a1a1a;border:1px solid #3a3324;border-radius:999px;">
                Application Received
              </div>

              <h1 style="margin:0 0 10px;color:#ffffff;font-size:30px;line-height:36px;font-weight:700;">
                Welcome to the process.
              </h1>

              <p style="margin:0;color:#b5b5b5;font-size:16px;line-height:26px;">
                We’re excited to see your interest in joining the BKFC Gym Network.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 32px;">

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Dear ${escapeHtml(contactPerson)},
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you for submitting your application for <strong style="color:#ffffff;">${escapeHtml(gymName)}</strong>.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                We’re excited to see your interest in joining the BKFC Gym Network and becoming part of the international development pathway we are building with selected combat sports gyms around the world.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Your application has been received successfully, and our team will now begin reviewing your gym profile, location, training environment, and role inside the BKFC Gym Network.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#171717;border:1px solid #2a2a2a;border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      Application Summary
                    </div>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Status:</strong> Submitted
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Gym:</strong> ${escapeHtml(gymName)}
                    </p>

                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Location:</strong> ${escapeHtml(cityCountry)}
                    </p>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:22px;">
                      <strong style="color:#c8a45d;">Application ID:</strong> ${escapeHtml(submissionId)}
                    </p>
                  </td>
                </tr>
              </table>

              ${portalUrl ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#171717;border:1px solid #3a3324;border-radius:12px;">
                <tr><td style="padding:20px;">
                  <div style="margin:0 0 10px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">Private application portal</div>
                  <p style="margin:0 0 16px;color:#d4d4d4;font-size:14px;line-height:24px;">Follow your application progress and see when BKFC needs an action from you.</p>
                  <a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#c8a45d;color:#000;text-decoration:none;font-size:14px;font-weight:800;">Open secure application portal</a>
                </td></tr>
              </table>
              ` : ""}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#141414;border-left:3px solid #c8a45d;border-radius:10px;">
                <tr>
                  <td style="padding:20px;">
                    <div style="margin:0 0 14px;color:#ffffff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;">
                      What happens next
                    </div>



                    <p style="margin:0 0 10px;color:#d4d4d4;font-size:14px;line-height:24px;">
                      If we need any additional information, photos, fighter details, or clarification, we will contact you directly.
                    </p>

                    <p style="margin:0;color:#d4d4d4;font-size:14px;line-height:24px;">
                      If approved, we will guide you through the next steps, including membership activation, starter kit preparation, and official affiliate onboarding.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                There is no need to submit another application. Your gym is now in the review pipeline.
              </p>

              <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">
                Thank you again for your interest in the BKFC Gym Network.
              </p>

              <p style="margin:28px 0 0;color:#ffffff;font-size:15px;font-weight:600;">
                BKFC International Development
              </p>

            </td>
          </tr>

          <tr>
            <td style="border-top:1px solid #262626;padding:20px 32px 28px;">
              <div style="margin:0 0 6px;color:#c8a45d;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">
                BKFC Gym Network
              </div>

              <p style="margin:0;color:#8a8a8a;font-size:12px;line-height:20px;">
                Official communication from BKFC International Development.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
`;
}


export async function sendApplicationNotifications(application: EmailApplication) {
  const routing = getEmailRouting(application.email);
  const sends: Array<{ type: "internal" | "applicant"; promise: ReturnType<Resend["emails"]["send"]> }> = [];
  let preparedPortal: PreparedApplicantPortalDelivery | null = null;
  if (
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
  if (!routing.applicant.enabled) {
    logApplicationEvent("warn", {
      stage: "notification",
      code: routing.applicant.skipCode ?? "EMAIL_TEST_DELIVERY_SKIPPED",
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
  if (routing.applicant.enabled && routing.applicant.from && routing.applicant.recipient) {
    sends.push({
      type: "applicant",
      promise: resend.emails.send({
        from: routing.applicant.from,
        to: routing.applicant.recipient,
        ...(routing.applicant.replyTo ? { replyTo: routing.applicant.replyTo } : {}),
        subject: `${routing.subjectPrefix}BKFC Gym Network — Application Received`,
        html: buildApplicantReceivedEmail({
          contactPerson: application.contactPerson,
          gymName: application.gymName,
          cityCountry: application.cityCountry,
          submissionId: application.applicationReference,
          ...(preparedPortal ? { portalUrl: preparedPortal.portalUrl } : {}),
        }),
      }),
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
