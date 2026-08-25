import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getBkfcIntegrationConfig, getCleanupConfig } from "@/lib/config/server";
import { runPaymentCommandWorker } from "@/lib/integrations/bkfc/payment-command-worker";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request, secret: string) {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function GET(request: Request) {
  try {
    const { cronSecret } = getCleanupConfig();
    if (!authorized(request, cronSecret)) {
      return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!getBkfcIntegrationConfig().paymentDeliveryEnabled) {
      return NextResponse.json({ success: false, code: "INTEGRATION_DISABLED" }, { status: 403 });
    }
    const summary = await runPaymentCommandWorker();
    return NextResponse.json({ success: summary.interventionRequired === 0, ...summary }, {
      status: summary.interventionRequired === 0 ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    console.error(JSON.stringify({ event: "bkfc_eu_integration", stage: "payment_delivery", code: "DELIVERY_UNAVAILABLE" }));
    return NextResponse.json({ success: false, code: "DELIVERY_UNAVAILABLE" }, { status: 503 });
  }
}
