import "server-only";

import { Resend } from "resend";
import {
  getEmailRouting,
  isApplicantPortalTestApplication,
} from "@/lib/config/server";
import { escapeHtml } from "./email-content";

export type ApplicantPortalDeliveryReason =
  | "application_received"
  | "more_information_required"
  | "replacement_required"
  | "approved"
  | "rejected"
  | "affiliate_activated"
  | "manual_applicant_update";

export type ApplicantPortalEmailApplication = {
  applicationReference: string;
  contactPerson: string;
  email: string;
  gymName: string;
};

export type ApplicantPortalEmailOutcome =
  | { status: "sent"; providerMessageId: string | null }
  | { status: "failed"; errorCode: string };

const CONTENT: Record<
  ApplicantPortalDeliveryReason,
  { badge: string; headline: string; intro: string; subject: string }
> = {
  application_received: {
    badge: "Application received",
    headline: "Your private application portal is ready",
    intro:
      "Use your secure portal to follow the progress of your BKFC Gym Network application.",
    subject: "BKFC Gym Network — Application Received",
  },
  more_information_required: {
    badge: "Action required",
    headline: "BKFC needs information from you",
    intro:
      "Open your secure portal to review the latest application update and the information requested by the BKFC team.",
    subject: "BKFC Gym Network — Information Required",
  },
  replacement_required: {
    badge: "Replacement required",
    headline: "A replacement file is needed",
    intro:
      "Open your secure portal to review the replacement instructions and the current state of your application.",
    subject: "BKFC Gym Network — Replacement Required",
  },
  approved: {
    badge: "Application update",
    headline: "Your application has been approved",
    intro:
      "Open your secure portal to review the latest status of your BKFC Gym Network application.",
    subject: "BKFC Gym Network — Application Approved",
  },
  rejected: {
    badge: "Application update",
    headline: "Your application review is complete",
    intro:
      "Open your secure portal to review the current status of your BKFC Gym Network application.",
    subject: "BKFC Gym Network — Application Update",
  },
  affiliate_activated: {
    badge: "Affiliate activated",
    headline: "Welcome to the BKFC Gym Network",
    intro:
      "Your secure portal now reflects your completed affiliate activation.",
    subject: "BKFC Gym Network — Affiliate Activated",
  },
  manual_applicant_update: {
    badge: "Secure portal access",
    headline: "Your private application link",
    intro:
      "Use this secure link to review the latest progress of your BKFC Gym Network application.",
    subject: "BKFC Gym Network — Secure Portal Access",
  },
};

function portalEmailHtml({
  application,
  portalUrl,
  reason,
  secondaryUrl,
}: {
  application: ApplicantPortalEmailApplication;
  portalUrl: string;
  reason: ApplicantPortalDeliveryReason;
  secondaryUrl?: string;
}) {
  const content = CONTENT[reason];
  return `
<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111111;border:1px solid #262626;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#c8a45d;padding:14px 24px;color:#000;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">BKFC Gym Network</td></tr>
        <tr><td style="padding:32px;">
          <div style="display:inline-block;margin:0 0 16px;padding:7px 12px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#c8a45d;background:#1a1a1a;border:1px solid #3a3324;border-radius:999px;">${escapeHtml(content.badge)}</div>
          <h1 style="margin:0 0 14px;color:#fff;font-size:30px;line-height:36px;">${escapeHtml(content.headline)}</h1>
          <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">Dear ${escapeHtml(application.contactPerson)},</p>
          <p style="margin:0 0 22px;color:#d4d4d4;font-size:15px;line-height:26px;">${escapeHtml(content.intro)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;background:#171717;border:1px solid #2a2a2a;border-radius:12px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 8px;color:#d4d4d4;font-size:14px;"><strong style="color:#c8a45d;">Gym:</strong> ${escapeHtml(application.gymName)}</p>
              <p style="margin:0;color:#d4d4d4;font-size:14px;"><strong style="color:#c8a45d;">Application reference:</strong> ${escapeHtml(application.applicationReference)}</p>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#c8a45d;border-radius:8px;"><a href="${escapeHtml(portalUrl)}" style="display:inline-block;padding:14px 22px;color:#000;text-decoration:none;font-size:14px;font-weight:800;">Open secure application portal</a></td></tr></table>
          ${secondaryUrl ? `<p style="margin:18px 0;color:#d4d4d4;font-size:14px;line-height:24px;">BKFC has also provided a single-purpose response link for the current request:</p><p style="margin:0 0 22px;"><a href="${escapeHtml(secondaryUrl)}" style="color:#f0ce7a;font-weight:700;">Open secure response form</a></p>` : ""}
          <p style="margin:22px 0 0;color:#8f8f8f;font-size:12px;line-height:20px;">Keep this email and its links private. The newest successfully delivered portal link replaces earlier portal links. If you lose access, use the recovery option on the portal page.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #262626;padding:20px 32px 28px;color:#8a8a8a;font-size:12px;line-height:20px;">Official communication from BKFC International Development.</td></tr>
      </table>
    </td></tr>
  </table>
</body>`;
}

function recoveryEmailHtml({
  application,
  recoveryUrl,
}: {
  application: ApplicantPortalEmailApplication;
  recoveryUrl: string;
}) {
  return `
<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;">
    <tr><td align="center"><table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111;border:1px solid #262626;border-radius:14px;overflow:hidden;">
      <tr><td style="background:#c8a45d;padding:14px 24px;color:#000;font-size:13px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">BKFC Gym Network</td></tr>
      <tr><td style="padding:32px;">
        <h1 style="margin:0 0 16px;color:#fff;font-size:30px;line-height:36px;">Recover your secure portal</h1>
        <p style="margin:0 0 18px;color:#e5e5e5;font-size:15px;line-height:26px;">Dear ${escapeHtml(application.contactPerson)},</p>
        <p style="margin:0 0 22px;color:#d4d4d4;font-size:15px;line-height:26px;">A recovery request was made for <strong style="color:#fff;">${escapeHtml(application.gymName)}</strong> (${escapeHtml(application.applicationReference)}).</p>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#c8a45d;border-radius:8px;"><a href="${escapeHtml(recoveryUrl)}" style="display:inline-block;padding:14px 22px;color:#000;text-decoration:none;font-size:14px;font-weight:800;">Recover portal access</a></td></tr></table>
        <p style="margin:0;color:#8f8f8f;font-size:12px;line-height:20px;">This single-use recovery link expires in 30 minutes. Using it invalidates the previous portal link. If you did not request recovery, ignore this email and your current portal link will remain valid.</p>
      </td></tr>
    </table></td></tr>
  </table>
</body>`;
}

async function sendApplicantEmail({
  application,
  subject,
  html,
}: {
  application: ApplicantPortalEmailApplication;
  subject: string;
  html: string;
}): Promise<ApplicantPortalEmailOutcome> {
  const routing = getEmailRouting(application.email);
  if (
    !routing.applicantDeliveryEnabled &&
    !isApplicantPortalTestApplication(application.applicationReference)
  ) {
    return {
      status: "failed",
      errorCode: "PORTAL_TEST_APPLICATION_NOT_ALLOWED",
    };
  }
  if (
    !routing.providerApiKey ||
    !routing.applicant.enabled ||
    !routing.applicant.from ||
    !routing.applicant.recipient
  ) {
    return {
      status: "failed",
      errorCode: routing.applicant.skipCode ?? "CONFIG_EMAIL_INVALID",
    };
  }
  try {
    const result = await new Resend(routing.providerApiKey).emails.send({
      from: routing.applicant.from,
      to: routing.applicant.recipient,
      ...(routing.applicant.replyTo ? { replyTo: routing.applicant.replyTo } : {}),
      subject: `${routing.subjectPrefix}${subject}`,
      html,
    });
    if (result.error) return { status: "failed", errorCode: "PROVIDER_REJECTED" };
    return { status: "sent", providerMessageId: result.data?.id ?? null };
  } catch {
    return { status: "failed", errorCode: "PROVIDER_UNAVAILABLE" };
  }
}

export function isApplicantPortalDeliveryTargetAllowed(
  application: ApplicantPortalEmailApplication,
) {
  const routing = getEmailRouting(application.email);
  return (
    routing.applicantDeliveryEnabled ||
    isApplicantPortalTestApplication(application.applicationReference)
  );
}

export function applicantPortalSubject(reason: ApplicantPortalDeliveryReason) {
  return CONTENT[reason].subject;
}

export async function sendApplicantPortalAccessEmail(input: {
  application: ApplicantPortalEmailApplication;
  portalUrl: string;
  reason: ApplicantPortalDeliveryReason;
  secondaryUrl?: string;
}) {
  return sendApplicantEmail({
    application: input.application,
    subject: CONTENT[input.reason].subject,
    html: portalEmailHtml(input),
  });
}

export async function sendApplicantPortalRecoveryEmail(input: {
  application: ApplicantPortalEmailApplication;
  recoveryUrl: string;
}) {
  return sendApplicantEmail({
    application: input.application,
    subject: "BKFC Gym Network — Portal Recovery",
    html: recoveryEmailHtml(input),
  });
}
