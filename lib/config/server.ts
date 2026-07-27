import "server-only";

import {
  resolveEmailRouting,
  resolveCleanupConfig,
  resolvePrivilegedSupabaseConfig,
  resolveProxyTrustConfig,
  resolvePublicSupabaseConfig,
  resolveRateLimitConfig,
  resolveTurnstileConfig,
} from "./policy";

export function getPrivilegedSupabaseConfig() {
  return resolvePrivilegedSupabaseConfig(process.env);
}

export function getPublicSupabaseConfig() {
  return resolvePublicSupabaseConfig(process.env);
}

export function getRateLimitConfig() {
  return resolveRateLimitConfig(process.env);
}

export function getProxyTrustConfig() {
  return resolveProxyTrustConfig(process.env);
}

export function getTurnstileConfig() {
  return resolveTurnstileConfig(process.env);
}

export function getCleanupConfig() {
  return resolveCleanupConfig(process.env);
}

export function getEmailRouting(applicantEmail: string) {
  return resolveEmailRouting(applicantEmail, process.env);
}

export function isInformationResponseEnabled() {
  return process.env.INFORMATION_RESPONSE_ENABLED?.trim().toLowerCase() === "true";
}

export function isApplicantPortalEnabled() {
  return process.env.APPLICANT_PORTAL_ENABLED?.trim().toLowerCase() === "true";
}

export function isApplicantPortalEmailDeliveryEnabled() {
  return process.env.APPLICANT_PORTAL_EMAIL_DELIVERY_ENABLED?.trim().toLowerCase() === "true";
}

export function isApplicantPortalRecoveryEnabled() {
  return process.env.APPLICANT_PORTAL_RECOVERY_ENABLED?.trim().toLowerCase() === "true";
}

export function getApplicationPublicUrl() {
  const configured = process.env.APPLICATION_PUBLIC_URL?.trim();
  if (!configured && process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  if (!configured) {
    throw new Error("APPLICATION_PUBLIC_URL is required for applicant portal email delivery.");
  }
  const url = new URL(configured);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("APPLICATION_PUBLIC_URL is invalid.");
  }
  url.pathname = "/";
  return url.toString().replace(/\/$/, "");
}

export function isApplicantPortalTestApplication(applicationReference: string) {
  const allowedReference =
    process.env.APPLICANT_PORTAL_TEST_APPLICATION_REFERENCE
      ?.trim()
      .toLocaleUpperCase("en-US") ?? "";
  return Boolean(
    allowedReference &&
    allowedReference === applicationReference.trim().toLocaleUpperCase("en-US"),
  );
}
