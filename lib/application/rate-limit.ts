import "server-only";

import { createHmac } from "node:crypto";
import type { ProxyProvider } from "@/lib/config/policy";

export function trustedRequestOrigin(request: Request, provider: ProxyProvider) {
  if (provider === "vercel") {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
  if (provider === "cloudflare") {
    return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
  }
  return "unknown";
}

export function rateLimitIdentifier(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
