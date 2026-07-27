import { NextResponse } from "next/server";
import { getProxyTrustConfig, getTurnstileConfig } from "@/lib/config/server";
import { logApplicationEvent } from "@/lib/application/logging";
import { ApplicationError, IDEMPOTENCY_KEY_PATTERN } from "@/lib/application/policy";
import { trustedRequestOrigin } from "@/lib/application/rate-limit";
import { issueTurnstileProof, verifyTurnstileToken } from "@/lib/application/turnstile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 8 * 1024) {
    return NextResponse.json({ success: false, code: "REQUEST_TOO_LARGE" }, { status: 413 });
  }
  try {
    const body = await request.json() as { turnstileToken?: unknown; idempotencyKey?: unknown };
    if (typeof body.idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(body.idempotencyKey)) {
      return NextResponse.json({ success: false, code: "VALIDATION_FAILED" }, { status: 400 });
    }
    const hostname = new URL(request.url).hostname;
    const proxy = getProxyTrustConfig();
    const config = getTurnstileConfig();
    await verifyTurnstileToken({
      token: body.turnstileToken,
      remoteIp: trustedRequestOrigin(request, proxy.provider),
      idempotencyKey: body.idempotencyKey,
      requestHostname: hostname,
    }, config);
    const proof = issueTurnstileProof(body.idempotencyKey, hostname, config.proofSecret);
    logApplicationEvent("info", { stage: "captcha", code: "CAPTCHA_VERIFIED", durationMs: Date.now() - startedAt });
    return NextResponse.json({ success: true, proof }, { headers: { "cache-control": "no-store" } });
  } catch (caught) {
    if (caught instanceof ApplicationError) {
      logApplicationEvent("warn", {
        stage: "captcha",
        code: caught.code,
        field: caught.field,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.json({ success: false, code: caught.code, field: caught.field }, { status: caught.status });
    }
    logApplicationEvent("error", { stage: "captcha", code: "CAPTCHA_UNAVAILABLE", durationMs: Date.now() - startedAt });
    return NextResponse.json({ success: false, code: "CAPTCHA_UNAVAILABLE" }, { status: 503 });
  }
}
