import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runApplicationReceiptWorker } from "@/lib/application/application-receipt-worker";
import { getCleanupConfig } from "@/lib/config/server";

import { resolveReceiptConfig } from "@/lib/application/receipt-policy";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: Request, expected: string) {
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${expected}`);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

export async function GET(request: Request) {
  try {
    const communication = resolveReceiptConfig(process.env);
    const { cronSecret } = getCleanupConfig();
    if (!authorized(request, cronSecret)) {
      return NextResponse.json({ success: false, code: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!communication.enabled) {
      return NextResponse.json({ success: false, code: "COMMUNICATIONS_DISABLED" }, { status: 404 });
    }
    const summary = await runApplicationReceiptWorker();
    return NextResponse.json({ success: summary.failed === 0, ...summary }, {
      status: summary.failed === 0 ? 200 : 503,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    console.error(JSON.stringify({ event: "application_receipts", code: "COMMUNICATION_WORKER_UNAVAILABLE" }));
    return NextResponse.json({ success: false, code: "COMMUNICATIONS_UNAVAILABLE" }, { status: 503 });
  }
}
