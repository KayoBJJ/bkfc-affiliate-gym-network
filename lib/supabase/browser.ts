"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getBrowserSupabaseConfig } from "@/lib/config/public";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getBrowserSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
