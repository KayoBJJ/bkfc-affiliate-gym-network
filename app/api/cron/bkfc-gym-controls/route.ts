import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBkfcIntegrationConfig, getCleanupConfig } from "@/lib/config/server";
import { runGymControlWorker } from "@/lib/integrations/bkfc/gym-control-worker";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const expected = Buffer.from(`Bearer ${getCleanupConfig().cronSecret}`);
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
    if (!getBkfcIntegrationConfig().gymControlDeliveryEnabled) return NextResponse.json({ code: "INTEGRATION_DISABLED" }, { status: 403 });
    return NextResponse.json(await runGymControlWorker(), { headers: { "cache-control": "no-store" } });
  } catch { return NextResponse.json({ code: "CONTROL_WORKER_UNAVAILABLE" }, { status: 503 }); }
}
