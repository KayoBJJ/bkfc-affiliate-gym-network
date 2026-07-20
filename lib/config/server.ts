import "server-only";

import {
  resolveEmailRouting,
  resolvePrivilegedSupabaseConfig,
  resolveProxyTrustConfig,
  resolvePublicSupabaseConfig,
  resolveRateLimitConfig,
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

export function getEmailRouting(applicantEmail: string) {
  return resolveEmailRouting(applicantEmail, process.env);
}
