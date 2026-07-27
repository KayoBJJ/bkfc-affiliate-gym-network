import { createHmac, timingSafeEqual } from "node:crypto";
import { ApplicationError } from "./policy.ts";
import { TURNSTILE_ACTION } from "./turnstile-contract.ts";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;
const MAX_CHALLENGE_AGE_MS = 5 * 60 * 1000;

export type TurnstileVerificationConfig = {
  secretKey: string;
  proofSecret: string;
  expectedHostnames: readonly string[];
};

type SiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

type VerifyTurnstileInput = {
  token: unknown;
  remoteIp?: string;
  idempotencyKey: string;
  requestHostname: string;
  expectedAction?: string;
  now?: number;
};

export async function verifyTurnstileToken(
  input: VerifyTurnstileInput,
  config: TurnstileVerificationConfig,
  fetchImpl: typeof fetch = fetch,
) {
  if (typeof input.token !== "string" || !input.token.trim()) {
    throw new ApplicationError("CAPTCHA_REQUIRED", 400, "turnstile");
  }
  const token = input.token.trim();
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new ApplicationError("CAPTCHA_INVALID", 400, "turnstile");
  }

  const body = new URLSearchParams({
    secret: config.secretKey,
    response: token,
    idempotency_key: input.idempotencyKey,
  });
  if (input.remoteIp && input.remoteIp !== "unknown") body.set("remoteip", input.remoteIp);

  let response: Response;
  try {
    response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApplicationError("CAPTCHA_UNAVAILABLE", 503, "turnstile");
  }
  if (!response.ok) throw new ApplicationError("CAPTCHA_UNAVAILABLE", 503, "turnstile");

  let result: SiteverifyResponse;
  try {
    result = await response.json() as SiteverifyResponse;
  } catch {
    throw new ApplicationError("CAPTCHA_UNAVAILABLE", 503, "turnstile");
  }

  const challengedAt = Date.parse(result.challenge_ts ?? "");
  const now = input.now ?? Date.now();
  const hostname = result.hostname?.toLocaleLowerCase("en-US");
  const requestHostname = input.requestHostname.toLocaleLowerCase("en-US");
  const expectedHostnames = config.expectedHostnames.map((value) => value.toLocaleLowerCase("en-US"));
  const valid = result.success === true &&
    result.action === (input.expectedAction ?? TURNSTILE_ACTION) &&
    Boolean(hostname && expectedHostnames.includes(hostname)) &&
    hostname === requestHostname &&
    Number.isFinite(challengedAt) &&
    challengedAt <= now + 30_000 &&
    now - challengedAt <= MAX_CHALLENGE_AGE_MS;

  if (!valid) throw new ApplicationError("CAPTCHA_INVALID", 400, "turnstile");
  return { hostname: hostname!, challengedAt: new Date(challengedAt).toISOString() };
}

function proofSignature(idempotencyKey: string, hostname: string, issuedAt: number, secret: string) {
  return createHmac("sha256", secret)
    .update(`${idempotencyKey}.${hostname.toLocaleLowerCase("en-US")}.${issuedAt}`)
    .digest("base64url");
}

export function issueTurnstileProof(
  idempotencyKey: string,
  hostname: string,
  secret: string,
  issuedAt = Date.now(),
) {
  return `${issuedAt}.${proofSignature(idempotencyKey, hostname, issuedAt, secret)}`;
}

export function verifyTurnstileProof(
  proof: unknown,
  idempotencyKey: string,
  hostname: string,
  secret: string,
  now = Date.now(),
) {
  if (typeof proof !== "string") throw new ApplicationError("CAPTCHA_REQUIRED", 400, "turnstile");
  const match = proof.match(/^(\d{13})\.([A-Za-z0-9_-]{43})$/);
  if (!match) throw new ApplicationError("CAPTCHA_INVALID", 400, "turnstile");
  const issuedAt = Number(match[1]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now + 30_000 || now - issuedAt > MAX_CHALLENGE_AGE_MS) {
    throw new ApplicationError("CAPTCHA_INVALID", 400, "turnstile");
  }
  const supplied = Buffer.from(match[2]);
  const expected = Buffer.from(proofSignature(idempotencyKey, hostname, issuedAt, secret));
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new ApplicationError("CAPTCHA_INVALID", 400, "turnstile");
  }
}
