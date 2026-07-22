import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCleanupConfig, getPrivilegedSupabaseConfig } from "@/lib/config/server";
import { runApplicationCleanup } from "@/lib/application/upload-session-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request, expected: string) {
  const supplied = request.headers.get("authorization") ?? "";
  const wanted = `Bearer ${expected}`;
  const suppliedBytes = Buffer.from(supplied);
  const wantedBytes = Buffer.from(wanted);
  return suppliedBytes.length === wantedBytes.length && timingSafeEqual(suppliedBytes, wantedBytes);
}

export async function GET(request: Request) {
  try {
    const cleanup = getCleanupConfig();
    if (!authorized(request, cleanup.cronSecret)) {
      return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
    }
    const config = getPrivilegedSupabaseConfig();
    const supabase = createClient<any>(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const summary = await runApplicationCleanup(supabase, cleanup);
    return NextResponse.json({ success: summary.failures === 0, ...summary }, {
      status: summary.failures === 0 ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    console.error(JSON.stringify({ event: "affiliate_application_cleanup", code: "CLEANUP_CONFIGURATION_FAILED" }));
    return NextResponse.json({ success: false, code: "CLEANUP_UNAVAILABLE" }, { status: 503 });
  }
}
