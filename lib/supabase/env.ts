import "server-only";
import { getPrivilegedSupabaseConfig, getPublicSupabaseConfig } from "@/lib/config/server";

export function getSupabaseUrl() {
  return getPublicSupabaseConfig().url;
}

export function getSupabaseAnonKey() {
  return getPublicSupabaseConfig().anonKey;
}

export function getSupabaseServiceRoleKey() {
  return getPrivilegedSupabaseConfig().serviceRoleKey;
}
