import { escapeHtml } from "./email-content.ts";

export type ReceivedEmailInput = {
  contactPerson: string;
  gymName: string;
  cityCountry: string;
  submissionId: string;
  portalUrl?: string;
  supportEmail?: string;
  gymNetworkUrl?: string;
  privacyUrl?: string;
  termsUrl?: string;
  // Preview overrides; delivery uses inline images supplied to Resend.
  headerSrc?: string;
  logoSrc?: string;
};

export function buildApplicantReceivedEmail(input: ReceivedEmailInput) {
  const e = escapeHtml;
  const portalUrl = input.portalUrl && /^https?:\/\//i.test(input.portalUrl) ? input.portalUrl : undefined;
  const supportEmail = input.supportEmail ?? "bkfcgym@bkfc.com";
  const support = supportEmail && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(supportEmail)
    ? supportEmail : undefined;
  const footerLink = (label: string, destination?: string) => {
    if (destination) {
      try {
        const url = new URL(destination);
        if (url.protocol === "https:" && !url.username && !url.password) {
          return `<a href="${e(url.toString())}" style="color:#BDBDBD;text-decoration:underline;">${e(label)}</a>`;
        }
      } catch { /* Keep unconfigured or invalid destinations as plain labels. */ }
    }
    return `<span style="color:#BDBDBD;text-decoration:underline;">${e(label)}</span>`;
  };
  const detail = (label: string, value: string, mono = false) => `<tr><td class="detail-label" style="padding:12px 0;border-bottom:1px solid #E2E2DE;width:34%;color:#6B6B6B;font-size:14px;line-height:22px;vertical-align:top;">${e(label)}</td><td class="detail-value" style="padding:12px 0;border-bottom:1px solid #E2E2DE;color:#222222;font-size:16px;line-height:24px;font-weight:bold;overflow-wrap:anywhere;word-break:break-word;${mono ? 'font-family:Courier New,monospace;' : ''}">${e(value)}</td></tr>`;
  return `<!doctype html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Application received</title>
<style>body{margin:0;padding:0}table{border-collapse:collapse}a{color:inherit}@media only screen and (max-width:620px){.outer{padding:0!important}.content,.footer{padding-left:20px!important;padding-right:20px!important}h1{font-size:28px!important;line-height:34px!important}.detail-label,.detail-value{display:block!important;width:100%!important}.detail-label{padding-bottom:0!important;border-bottom:0!important}.detail-value{padding-top:4px!important}.action{display:block!important;text-align:center!important;padding-left:8px!important;padding-right:8px!important}}</style></head>
<body style="margin:0;background:#EDEDED;font-family:Arial,Helvetica,sans-serif;color:#3A3A3A;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">We've received the application for ${e(input.gymName)}. Your reference: ${e(input.submissionId)}.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#EDEDED"><tr><td class="outer" align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;table-layout:fixed;background:#FFFFFF;" bgcolor="#FFFFFF">
<tr><td bgcolor="#161616" style="background:#161616;color:#FFD43F;"><img src="${e(input.headerSrc ?? 'cid:bkfc-gym-header')}" alt="BKFC Gym Network" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;color:#FFD43F;"></td></tr>
<tr><td class="content" style="padding:40px 32px;color:#3A3A3A;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td width="24" style="vertical-align:middle;"><div style="height:4px;background:#FFD43F;font-size:1px;line-height:4px;">&nbsp;</div></td><td style="padding-left:12px;color:#6B6B6B;font-size:14px;line-height:20px;letter-spacing:2px;font-weight:bold;">GYM NETWORK APPLICATION</td></tr></table>
<h1 style="margin:12px 0 24px;font-size:30px;line-height:36px;color:#222222;">Application received</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:26px;">Hi ${e(input.contactPerson)},</p>
<p style="margin:0 0 28px;font-size:16px;line-height:26px;">We've received the BKFC Gym Network application for <strong style="color:#222222;">${e(input.gymName)}</strong>. Our team will review your submission and contact you if we need any additional information.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="#F5F5F3" style="table-layout:fixed;background:#F5F5F3;border-left:4px solid #FFD43F;"><tr><td style="padding:20px;">
<p style="margin:0 0 8px;color:#222222;font-size:14px;line-height:22px;font-weight:bold;letter-spacing:2px;">APPLICATION DETAILS</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;">${detail('Gym',input.gymName)}${detail('Location',input.cityCountry)}${detail('Application ID',input.submissionId,true)}
<tr><td class="detail-label" style="width:34%;padding:12px 0 0;color:#6B6B6B;font-size:14px;line-height:22px;">Status</td><td class="detail-value" style="padding:12px 0 0;"><span style="display:inline-block;background:#FFD43F;color:#222222;border-radius:14px;padding:4px 14px;font-size:14px;line-height:20px;letter-spacing:1px;font-weight:bold;">RECEIVED</span></td></tr></table></td></tr></table>
${portalUrl ? `<p style="margin:28px 0 16px;font-size:16px;line-height:26px;">Follow your application progress and see when we need an action from you in your private application portal.</p>
<!--[if mso]><v:roundrect href="${e(portalUrl)}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="8%" stroke="f" fillcolor="#FFD43F"><w:anchorlock/><center style="color:#222222;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Open application portal</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a class="action" href="${e(portalUrl)}" style="display:inline-block;background:#FFD43F;color:#222222;padding:14px 28px;border-radius:4px;font-size:16px;line-height:20px;font-weight:bold;text-decoration:none;">Open application portal</a><!--<![endif]-->` : ''}
<p style="margin:28px 0 16px;font-size:16px;line-height:26px;">There is no need to submit another application. If approved, we will guide you through the next steps for membership activation and affiliate onboarding.</p>
${support ? `<p style="margin:0 0 16px;font-size:16px;line-height:26px;">Questions about your application? Contact us at <a href="mailto:${e(support)}" style="color:#222222;font-weight:bold;text-decoration:underline;">${e(support)}</a>.</p>` : ''}
<p style="margin:0;font-size:16px;line-height:26px;">The BKFC Gym Network team</p></td></tr>
<tr><td style="height:3px;background:#FFD43F;font-size:1px;line-height:3px;">&nbsp;</td></tr><tr><td style="height:3px;background:#222222;font-size:1px;line-height:3px;">&nbsp;</td></tr>
<tr><td class="footer" bgcolor="#161616" style="padding:28px 32px;background:#161616;color:#BDBDBD;">
<img src="${e(input.logoSrc ?? 'cid:bkfc-gym-logo')}" width="120" height="25" alt="BKFC" style="display:block;width:120px;height:25px;color:#FFD43F;border:0;">
<p style="margin:16px 0 8px;color:#FFFFFF;font-size:14px;line-height:22px;font-weight:bold;letter-spacing:1px;">BKFC GYM NETWORK</p>
<p style="margin:0;font-size:14px;line-height:22px;">Live support: Mon–Fri, 9am–6pm ET</p>
${support ? `<p style="margin:0 0 16px;font-size:14px;line-height:22px;"><a href="mailto:${e(support)}" style="color:#FFD43F;">${e(support)}</a></p>` : ''}
<p style="margin:0;font-size:14px;line-height:22px;">${footerLink("Gym Network", input.gymNetworkUrl ?? "https://www.bkfc.com/gyms")} &nbsp;·&nbsp; ${footerLink("Privacy", input.privacyUrl ?? "https://www.bkfc.com/privacy-policy")} &nbsp;·&nbsp; ${footerLink("Terms", input.termsUrl ?? "https://www.bkfc.com/terms-of-use")}</p>
<p style="margin:0;color:#BDBDBD;font-size:13px;line-height:20px;">You're receiving this because an application was submitted for ${e(input.gymName)}.</p>
<p style="margin:4px 0 0;color:#BDBDBD;font-size:13px;line-height:20px;">Bare Knuckle Fighting Championship, Philadelphia, PA, USA</p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
