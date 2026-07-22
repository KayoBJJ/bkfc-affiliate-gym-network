import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ApplicationError } from "../lib/application/policy.ts";
import { TURNSTILE_ACTION } from "../lib/application/turnstile-contract.ts";
import { issueTurnstileProof, verifyTurnstileProof, verifyTurnstileToken } from "../lib/application/turnstile.ts";
import { isAbandonedSession, issuedPaths, runApplicationCleanup, type CleanupPolicy, type CleanupSession } from "../lib/application/upload-session-cleanup.ts";
import { ConfigurationError, resolveCleanupConfig, resolveTurnstileConfig } from "../lib/config/policy.ts";

const now = Date.parse("2026-07-22T12:00:00.000Z");
const turnstileConfig = {
  secretKey: "1x0000000000000000000000000000000AA",
  proofSecret: "A9!turnstile-proof-secret-with-32-characters",
  expectedHostnames: ["gyms.bkfc.com"],
};

function verifierResponse(overrides: Record<string, unknown> = {}) {
  return async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, "POST");
    const body = init?.body as URLSearchParams;
    assert.equal(body.get("secret"), turnstileConfig.secretKey);
    assert.equal(body.get("response"), "fresh-token");
    assert.equal(body.get("idempotency_key"), "58b3b08f-582f-4a1a-a11b-30b738532a23");
    return Response.json({
      success: true,
      challenge_ts: new Date(now - 10_000).toISOString(),
      hostname: "gyms.bkfc.com",
      action: TURNSTILE_ACTION,
      ...overrides,
    });
  };
}

async function expectCaptchaCode(overrides: Record<string, unknown>, code = "CAPTCHA_INVALID") {
  await assert.rejects(
    () => verifyTurnstileToken({ token: "fresh-token", idempotencyKey: "58b3b08f-582f-4a1a-a11b-30b738532a23", requestHostname: "gyms.bkfc.com", now }, turnstileConfig, verifierResponse(overrides) as typeof fetch),
    (error: unknown) => error instanceof ApplicationError && error.code === code,
  );
}

test("Turnstile accepts a fresh token only for the configured action and hostname", async () => {
  const result = await verifyTurnstileToken({
    token: "fresh-token",
    remoteIp: "203.0.113.10",
    idempotencyKey: "58b3b08f-582f-4a1a-a11b-30b738532a23",
    requestHostname: "gyms.bkfc.com",
    now,
  }, turnstileConfig, verifierResponse() as typeof fetch);
  assert.equal(result.hostname, "gyms.bkfc.com");
});

test("Turnstile fails closed for missing, failed, expired, wrong-action, and wrong-host tokens", async () => {
  await assert.rejects(
    () => verifyTurnstileToken({ token: "", idempotencyKey: "58b3b08f-582f-4a1a-a11b-30b738532a23", requestHostname: "gyms.bkfc.com" }, turnstileConfig, verifierResponse() as typeof fetch),
    (error: unknown) => error instanceof ApplicationError && error.code === "CAPTCHA_REQUIRED",
  );
  await expectCaptchaCode({ success: false, "error-codes": ["timeout-or-duplicate"] });
  await expectCaptchaCode({ challenge_ts: new Date(now - 6 * 60_000).toISOString() });
  await expectCaptchaCode({ action: "other_action" });
  await expectCaptchaCode({ hostname: "attacker.example" });
  await assert.rejects(
    () => verifyTurnstileToken({ token: "fresh-token", idempotencyKey: "58b3b08f-582f-4a1a-a11b-30b738532a23", requestHostname: "preview.example", now }, turnstileConfig, verifierResponse() as typeof fetch),
    (error: unknown) => error instanceof ApplicationError && error.code === "CAPTCHA_INVALID",
  );
});

test("Turnstile and cleanup configuration fail closed and cleanup defaults to dry-run", () => {
  assert.throws(() => resolveTurnstileConfig({}), (error: unknown) =>
    error instanceof ConfigurationError && error.code === "CONFIG_TURNSTILE_INVALID");
  assert.deepEqual(resolveTurnstileConfig({
    TURNSTILE_SECRET_KEY: turnstileConfig.secretKey,
    TURNSTILE_PROOF_SECRET: turnstileConfig.proofSecret,
    TURNSTILE_EXPECTED_HOSTNAMES: "gyms.bkfc.com, localhost",
  }).expectedHostnames, ["gyms.bkfc.com", "localhost"]);
  const cleanup = resolveCleanupConfig({ CRON_SECRET: "A9!secure-cleanup-secret-with-32-characters" });
  assert.equal(cleanup.dryRun, true);
  assert.equal(cleanup.batchSize, 50);
  assert.throws(() => resolveCleanupConfig({ CRON_SECRET: "short" }), (error: unknown) =>
    error instanceof ConfigurationError && error.code === "CONFIG_CLEANUP_INVALID");
});

test("Turnstile proof is short-lived and bound to idempotency key and request hostname", () => {
  const proof = issueTurnstileProof("58b3b08f-582f-4a1a-a11b-30b738532a23", "gyms.bkfc.com", turnstileConfig.proofSecret, now);
  assert.doesNotThrow(() => verifyTurnstileProof(proof, "58b3b08f-582f-4a1a-a11b-30b738532a23", "gyms.bkfc.com", turnstileConfig.proofSecret, now + 1_000));
  for (const values of [
    ["different-key", "gyms.bkfc.com", now + 1_000],
    ["58b3b08f-582f-4a1a-a11b-30b738532a23", "preview.example", now + 1_000],
    ["58b3b08f-582f-4a1a-a11b-30b738532a23", "gyms.bkfc.com", now + 6 * 60_000],
  ] as const) {
    assert.throws(() => verifyTurnstileProof(proof, values[0], values[1], turnstileConfig.proofSecret, values[2]),
      (error: unknown) => error instanceof ApplicationError && error.code === "CAPTCHA_INVALID");
  }
});

test("Turnstile does not inject its response field into the strict application form", async () => {
  const widget = await readFile("components/TurnstileWidget.tsx", "utf8");
  assert.match(widget, /["']response-field["']:\s*false/);
});

const cleanupPolicy: CleanupPolicy = {
  dryRun: true,
  abandonedSessionHours: 24,
  failedSessionHours: 12,
  finalizedSessionDays: 30,
  anonymousUserDays: 7,
  batchSize: 50,
};

function session(status: CleanupSession["status"], values: Partial<CleanupSession> = {}): CleanupSession {
  return {
    id: "123e4567-e89b-42d3-a456-426614174000",
    uploader_id: "123e4567-e89b-42d3-a456-426614174111",
    status,
    upload_manifest: [],
    expires_at: new Date(now - 25 * 60 * 60_000).toISOString(),
    updated_at: new Date(now - 13 * 60 * 60_000).toISOString(),
    ...values,
  };
}

test("cleanup eligibility honors separate abandoned and failed retention windows", () => {
  assert.equal(isAbandonedSession(session("pending"), cleanupPolicy, now), true);
  assert.equal(isAbandonedSession(session("pending", { expires_at: new Date(now - 23 * 60 * 60_000).toISOString() }), cleanupPolicy, now), false);
  assert.equal(isAbandonedSession(session("failed"), cleanupPolicy, now), true);
  assert.equal(isAbandonedSession(session("finalized"), cleanupPolicy, now), false);
});

test("cleanup accepts only generated session-scoped object paths and deduplicates them", () => {
  const path = "123e4567-e89b-42d3-a456-426614174000/logo/123e4567-e89b-42d3-a456-426614174001.png";
  assert.deepEqual(issuedPaths([{ path }, { path }, { path: "unsafe/path.png" }, {}]), [path]);
});

function cleanupClient(linked: boolean, dryRun: boolean) {
  const path = "123e4567-e89b-42d3-a456-426614174000/logo/123e4567-e89b-42d3-a456-426614174001.png";
  const mutations = { storageRemovals: 0, sessionDeletes: 0 };
  class Query {
    operation = "select";
    status = "";
    select() { return this; }
    in() { return this; }
    order() { return this; }
    lt() { return this; }
    eq(column: string, value: string) {
      if (column === "status") this.status = value;
      return this;
    }
    delete() { this.operation = "delete"; return this; }
    limit() { return this; }
    then(resolve: (value: unknown) => void) {
      if (this.operation === "delete") {
        mutations.sessionDeletes += 1;
        return Promise.resolve(resolve({ error: null }));
      }
      if (this.status === "finalized") return Promise.resolve(resolve({ data: [], error: null }));
      return Promise.resolve(resolve({ data: [session("expired", {
        upload_manifest: [{ path }],
        updated_at: new Date(now - 48 * 60 * 60_000).toISOString(),
      })], error: null }));
    }
  }
  const client = {
    from: () => new Query(),
    rpc: async () => ({ data: linked, error: null }),
    storage: { from: () => ({ remove: async () => { mutations.storageRemovals += 1; return { error: null }; } }) },
    auth: { admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      deleteUser: async () => ({ error: null }),
    } },
  };
  return { client, mutations, policy: { ...cleanupPolicy, dryRun } };
}

test("cleanup never removes a session when any issued object is linked to an application", async () => {
  const mocked = cleanupClient(true, false);
  const summary = await runApplicationCleanup(mocked.client as never, mocked.policy, now);
  assert.equal(summary.protectedSessions, 1);
  assert.equal(mocked.mutations.storageRemovals, 0);
  assert.equal(mocked.mutations.sessionDeletes, 0);
});

test("cleanup dry-run reports eligible data without performing mutations", async () => {
  const mocked = cleanupClient(false, true);
  const summary = await runApplicationCleanup(mocked.client as never, mocked.policy, now);
  assert.equal(summary.abandonedSessions, 1);
  assert.equal(summary.objects, 1);
  assert.equal(mocked.mutations.storageRemovals, 0);
  assert.equal(mocked.mutations.sessionDeletes, 0);
});

test("cleanup migration protects every application asset column and endpoint is cron secured", async () => {
  const sql = await readFile("supabase/migrations/20260722000000_turnstile_and_cleanup_policy.sql", "utf8");
  const endpoint = await readFile("app/api/cron/application-cleanup/route.ts", "utf8");
  const uploadRoute = await readFile("app/api/affiliate-registration/upload-session/route.ts", "utf8");
  const challengeRoute = await readFile("app/api/affiliate-registration/challenge/route.ts", "utf8");
  const browserAuth = await readFile("lib/application/resumable-upload-client.ts", "utf8");
  assert.match(sql, /application\.logo_path = p_path/);
  assert.match(sql, /application\.fighter_list_path = p_path/);
  assert.match(sql, /any\(coalesce\(application\.gym_photo_paths/);
  assert.match(sql, /grant execute[\s\S]*to service_role/i);
  assert.match(endpoint, /timingSafeEqual/);
  assert.match(endpoint, /getCleanupConfig/);
  assert.match(challengeRoute, /verifyTurnstileToken/);
  assert.match(uploadRoute, /verifyTurnstileProof/);
  assert.match(browserAuth, /signInAnonymously/);
});
