import { createHmac } from "node:crypto";
import { escapeHtml } from "./email-content.ts";

export const APPLICANT_NOTIFICATION_TYPES = [
  "more_information_required", "information_received", "approved", "rejected",
  "affiliate_activated", "manual_applicant_update",
] as const;
export type ApplicantNotificationType = typeof APPLICANT_NOTIFICATION_TYPES[number];

export type ApplicantCommunicationTemplate = {
  id: string; notification_type: ApplicantNotificationType; locale: string; version: number;
  approval_status: "approved" | "retired"; subject_template: string; headline_template: string;
  body_paragraphs: unknown; cta_label: string; footer_text: string;
};
export type ApplicantCommunicationVariables = {
  contact_person: string; gym_name: string; application_reference: string;
  request_summary: string; request_deadline: string;
};

const VARIABLE_PATTERN = /{{\s*([a-z_]+)\s*}}/g;
const ALLOWED_VARIABLES = new Set<keyof ApplicantCommunicationVariables>([
  "contact_person", "gym_name", "application_reference", "request_summary", "request_deadline",
]);

function renderText(template: string, variables: ApplicantCommunicationVariables) {
  const unknown = [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1])
    .filter((key) => !ALLOWED_VARIABLES.has(key as keyof ApplicantCommunicationVariables));
  if (unknown.length) throw new Error("TEMPLATE_VARIABLE_UNSUPPORTED");
  return template.replace(VARIABLE_PATTERN, (_match, key: keyof ApplicantCommunicationVariables) => {
    const value = variables[key];
    if (!value) throw new Error("TEMPLATE_VARIABLE_MISSING");
    return value;
  });
}

export function deriveApplicantCommunicationPortalToken(outboxId: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`bkfc-applicant-communication:${outboxId}`).digest("base64url");
}

export function notificationPortalReason(type: ApplicantNotificationType) {
  return type === "information_received" ? "manual_applicant_update" : type;
}

export function renderApplicantCommunication(input: {
  template: ApplicantCommunicationTemplate;
  variables: ApplicantCommunicationVariables;
  portalUrl: string;
}) {
  if (!["approved", "retired"].includes(input.template.approval_status)) {
    throw new Error("TEMPLATE_NOT_APPROVED");
  }
  if (!Array.isArray(input.template.body_paragraphs) || input.template.body_paragraphs.length < 1 ||
    input.template.body_paragraphs.some((paragraph) => typeof paragraph !== "string")) {
    throw new Error("TEMPLATE_BODY_INVALID");
  }
  const subject = renderText(input.template.subject_template, input.variables);
  if (/[\r\n]/.test(subject)) throw new Error("TEMPLATE_SUBJECT_INVALID");
  const headline = renderText(input.template.headline_template, input.variables);
  const paragraphs = input.template.body_paragraphs.map((paragraph) => renderText(paragraph, input.variables));
  const footer = renderText(input.template.footer_text, input.variables);
  const body = paragraphs.map((paragraph) =>
    `<p style="margin:0 0 18px;color:#d4d4d4;font-size:15px;line-height:26px;">${escapeHtml(paragraph)}</p>`).join("");
  const html = `<body style="margin:0;background:#080808;font-family:Arial,Helvetica,sans-serif;color:#fff;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:32px 12px;"><tr><td align="center"><table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#111;border:1px solid #262626;border-radius:14px;overflow:hidden;"><tr><td style="background:#c8a45d;padding:14px 24px;color:#000;font-weight:700;">BKFC Gym Network</td></tr><tr><td style="padding:32px;"><h1 style="margin:0 0 18px;color:#fff;font-size:30px;">${escapeHtml(headline)}</h1>${body}<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="background:#c8a45d;border-radius:8px;"><a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;padding:14px 22px;color:#000;text-decoration:none;font-weight:800;">${escapeHtml(input.template.cta_label)}</a></td></tr></table><p style="margin:22px 0 0;color:#8f8f8f;font-size:12px;line-height:20px;">${escapeHtml(footer)}</p></td></tr></table></td></tr></table></body>`;
  return { subject, html };
}
