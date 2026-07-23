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
