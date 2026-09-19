import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateBearer } from "../lib/integrations/bkfc/auth.ts";
import { IntegrationError, integrationErrorHeaders, integrationErrorPayload } from "../lib/integrations/bkfc/contracts.ts";
import { removeUploadedLogo } from "../lib/integrations/bkfc/logo-compensation.ts";
import {
  reconcileBkfcIntegrationOrphans, type OrphanReconcilerDependencies,
} from "../lib/integrations/bkfc/orphan-reconciler.ts";
import { consumeTokenBucket } from "../lib/integrations/bkfc/rate-limit.ts";
import {
  parseBkfcSubmissionIngress, readBoundedRequestBody,
} from "../lib/integrations/bkfc/submission-ingress.ts";
import {
  consumeSubmissionPreparseQuota, finalizeIngressReservation,
  requireAcquiredReservation, reserveIngress,
  SUBMISSION_PREPARSE_ENFORCEMENT_RETRY_SECONDS,
  type IngressReservation,
} from "../lib/integrations/bkfc/ingress-reservation.ts";
import { paymentDecisionForReviewTransition } from "../lib/integrations/bkfc/review-transition-policy.ts";
import { parseDisciplinesOffered } from "../lib/integrations/bkfc/submission.ts";
import { getApplicationRegion } from "../lib/application/region.ts";
import { ConfigurationError, resolveBkfcIntegrationConfig } from "../lib/config/policy.ts";

const currentSecret = "Abcdefghijklmnopqrstuvwxyz0123456789-ABCDEFGHIJK";
const previousSecret = "ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210-abcdefghijk";
const ingressRequestId = "6f314ad6-8d2f-4eb0-9df8-a6c1b547d88f";
const bkfcIdentity = { sourceSystem: "bkfc", sourceApplicationId: "BKFC-APP-123" };
const approved = { reviewStage: "approved", status: "approved" };
const submitted = { reviewStage: "submitted", status: "new" };
const activated = { reviewStage: "activated_affiliate", status: "active" };
const allowPreparseQuota = async () => ({ allowed: true, retryAfterSeconds: 0 });

test("disciplines split the raw value on every frozen delimiter before item normalization", () => {
  assert.deepEqual(parseDisciplinesOffered("Boxing\nMMA"), ["Boxing", "MMA"]);
  assert.deepEqual(parseDisciplinesOffered("Boxing,MMA"), ["Boxing", "MMA"]);
  assert.deepEqual(parseDisciplinesOffered("Boxing;MMA"), ["Boxing", "MMA"]);
  assert.deepEqual(parseDisciplinesOffered("Boxing, MMA;BJJ\n Muay\tThai"), ["Boxing", "MMA", "BJJ", "Muay Thai"]);
  assert.deepEqual(parseDisciplinesOffered(",,Boxing;;;\n\nMMA,;"), ["Boxing", "MMA"]);
  assert.deepEqual(parseDisciplinesOffered("x".repeat(100)), ["x".repeat(100)]);
  assert.equal(parseDisciplinesOffered("x,".repeat(19) + "x").length, 20);
  assert.deepEqual(parseDisciplinesOffered("x".repeat(2000)), ["x".repeat(2000)]);
  assert.equal(parseDisciplinesOffered("x,".repeat(999) + "x").length, 1000);
  assert.throws(() => parseDisciplinesOffered("x".repeat(2001)), IntegrationError);
  assert.throws(() => parseDisciplinesOffered(" , ;\n "), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUIRED_FIELD_MISSING");
});

test("shared macro-region derivation preserves every established category", () => {
  assert.equal(getApplicationRegion(" Bulgaria "), "Europe");
  assert.equal(getApplicationRegion("United Arab Emirates"), "MENA");
  assert.equal(getApplicationRegion("Brazil"), "LATAM");
  assert.equal(getApplicationRegion("Canada"), "North America");
  assert.equal(getApplicationRegion("Japan"), "Other");
});

test("legacy transitions remain payment-neutral while BKFC transitions enforce payment", () => {
  assert.equal(paymentDecisionForReviewTransition({ sourceSystem: null, sourceApplicationId: null, current: submitted, target: approved }), "none");
  assert.equal(paymentDecisionForReviewTransition({ sourceSystem: null, sourceApplicationId: null, current: approved, target: activated }), "none");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: submitted, target: approved, paymentStatus: "not_requested" }), "initiate");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: submitted, target: approved, paymentStatus: "pending", cancellationActivity: true }), "initiate");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: submitted, target: approved, paymentStatus: "pending", cancellationActivity: false }), "none");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: submitted, target: approved, paymentStatus: "refunded" }), "deny_reapproval");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: approved, target: approved, paymentStatus: "pending" }), "no_op");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: approved, target: activated, paymentStatus: "pending" }), "deny_activation");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: approved, target: activated, paymentStatus: "paid" }), "none");
  assert.equal(paymentDecisionForReviewTransition({ sourceSystem: "bkfc", sourceApplicationId: null, current: submitted, target: approved }), "none");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: approved, target: submitted, paymentStatus: "pending", initiationDeliveryStatus: "queued", initiationClaimed: false }), "suppress");
  assert.equal(paymentDecisionForReviewTransition({ ...bkfcIdentity, current: approved, target: submitted, paymentStatus: "paid", initiationDeliveryStatus: "sending", initiationClaimed: true }), "cancel");
});

test("credential rotation authenticates both slots without retaining raw credentials", () => {
  const current = authenticateBearer(`Bearer ${currentSecret}`, [currentSecret, previousSecret]);
  const previous = authenticateBearer(`Bearer ${previousSecret}`, [currentSecret, previousSecret]);
  assert.equal(current.authorized, true);
  assert.equal(previous.authorized, true);
  if (!current.authorized || !previous.authorized) return;
  assert.match(current.credentialFingerprint, /^[a-f0-9]{64}$/);
  assert.match(previous.credentialFingerprint, /^[a-f0-9]{64}$/);
  assert.notEqual(current.credentialFingerprint, previous.credentialFingerprint);
  assert.equal(current.credentialFingerprint.includes(currentSecret), false);
});

test("orphan reconciliation configuration fails closed and defaults to disabled dry-run", () => {
  const defaults = resolveBkfcIntegrationConfig({});
  assert.equal(defaults.orphanCleanupEnabled, false);
  assert.equal(defaults.orphanCleanupDryRun, true);
  assert.equal(defaults.orphanCleanupBatchSize, 50);
  assert.throws(() => resolveBkfcIntegrationConfig({
    BKFC_INTEGRATION_ORPHAN_CLEANUP_ENABLED: "yes",
  }), ConfigurationError);
  assert.throws(() => resolveBkfcIntegrationConfig({
    BKFC_INTEGRATION_ORPHAN_CLEANUP_BATCH_SIZE: "501",
  }), ConfigurationError);
});

test("durable rate policy permits bursts, exhausts, refills and resets independently", () => {
  let preparseState;
  for (let index = 0; index < 10; index += 1) {
    const result = consumeTokenBucket("submission_preparse", preparseState, 0);
    assert.equal(result.allowed, true);
    preparseState = result.state;
  }
  assert.deepEqual(consumeTokenBucket("submission_preparse", preparseState, 0), {
    allowed: false,
    retryAfterSeconds: 1,
    state: { tokens: 0, lastRefillMs: 0 },
  });

  let submissionState;
  for (let index = 0; index < 10; index += 1) {
    const result = consumeTokenBucket("submission", submissionState, 0);
    assert.equal(result.allowed, true);
    submissionState = result.state;
  }
  const limited = consumeTokenBucket("submission", submissionState, 0);
  assert.equal(limited.allowed, false);
  assert.equal(limited.retryAfterSeconds, 1);
  assert.equal(consumeTokenBucket("submission", limited.state, 1_000).allowed, true);
  assert.equal(consumeTokenBucket("submission", limited.state, 60_000).state.tokens, 9);

  let callbackState;
  for (let index = 0; index < 50; index += 1) callbackState = consumeTokenBucket("callback", callbackState, 0).state;
  assert.equal(consumeTokenBucket("callback", callbackState, 0).allowed, false);
  assert.equal(consumeTokenBucket("callback", callbackState, 200).allowed, true);
});

function streamingRequest(input: {
  chunks: Uint8Array[];
  headers: HeadersInit;
  onPull?: () => void;
  onCancel?: () => void;
  cancelResult?: Promise<void>;
}) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      input.onPull?.();
      if (index >= input.chunks.length) controller.close();
      else controller.enqueue(input.chunks[index++]);
    },
    cancel() { input.onCancel?.(); return input.cancelResult; },
  }, { highWaterMark: 0 });
  return new Request("https://eu.example.test/api/v1/integrations/bkfc/affiliate-applications", {
    method: "POST", headers: input.headers, body, duplex: "half",
  } as RequestInit & { duplex: "half" });
}

function ingressHeaders(contentType: string, contentLength: number) {
  return {
    authorization: `Bearer ${currentSecret}`,
    accept: "application/json",
    "x-request-id": ingressRequestId,
    "idempotency-key": "58b3b08f-582f-4a1a-a11b-30b738532a23",
    "x-bkfc-application-id": "BKFC-APP-123",
    "content-type": contentType,
    "content-length": String(contentLength),
  };
}

test("BKFC multipart ingress authenticates and throttles before consuming body bytes", async () => {
  let pulls = 0;
  let quotaCalls = 0;
  const unauthorized = streamingRequest({
    chunks: [new Uint8Array([1])],
    headers: { ...ingressHeaders("multipart/form-data; boundary=test", 1), authorization: "Bearer invalid" },
    onPull: () => { pulls += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(unauthorized, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: async () => { quotaCalls += 1; return { allowed: true, retryAfterSeconds: 0 }; },
  }), (error: unknown) => error instanceof IntegrationError && error.code === "UNAUTHORIZED");
  assert.equal(pulls, 0);
  assert.equal(quotaCalls, 0);

  const throttled = streamingRequest({
    chunks: [new Uint8Array([1])], headers: ingressHeaders("multipart/form-data; boundary=test", 1),
    onPull: () => { pulls += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(throttled, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: async () => {
      quotaCalls += 1;
      return { allowed: false, retryAfterSeconds: 3 };
    },
  }), (error: unknown) => error instanceof IntegrationError && error.code === "RATE_LIMITED" &&
    error.retryAfterSeconds === 3);
  assert.equal(pulls, 0);
  assert.equal(quotaCalls, 1);

  const invalidHeaders = streamingRequest({
    chunks: [new Uint8Array([1])],
    headers: { ...ingressHeaders("multipart/form-data; boundary=test", 1), accept: "*/*" },
    onPull: () => { pulls += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(invalidHeaders, {
    requestId: ingressRequestId,
    bearerSecrets: [currentSecret],
    consumePreparseQuota: async () => {
      quotaCalls += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    },
  }), (error: unknown) => error instanceof IntegrationError && error.code === "UNSUPPORTED_MEDIA_TYPE");
  assert.equal(pulls, 0);
  assert.equal(quotaCalls, 1);
});

test("actual BKFC request bytes are bounded and the stream is cancelled on overflow", async () => {
  let cancelled = 0;
  let pulls = 0;
  const request = streamingRequest({
    chunks: [new Uint8Array(6), new Uint8Array(6), new Uint8Array(6)],
    headers: { "content-type": "application/octet-stream" },
    onPull: () => { pulls += 1; }, onCancel: () => { cancelled += 1; },
  });
  await assert.rejects(() => readBoundedRequestBody(request, 10), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE" && error.status === 413);
  assert.equal(cancelled, 1);
  assert.equal(pulls, 2);
  assert.equal(request.body?.locked, false);

  const exact = streamingRequest({
    chunks: [new Uint8Array(10)], headers: { "content-type": "application/octet-stream" },
  });
  assert.equal((await readBoundedRequestBody(exact, 10)).byteLength, 10);
  assert.equal(exact.body?.locked, false);

  let singleChunkCancelled = 0;
  const singleChunk = streamingRequest({
    chunks: [new Uint8Array(11)], headers: { "content-type": "application/octet-stream" },
    onCancel: () => { singleChunkCancelled += 1; },
    cancelResult: Promise.reject(new Error("synthetic cancellation failure")),
  });
  await assert.rejects(() => readBoundedRequestBody(singleChunk, 10), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE");
  assert.equal(singleChunkCancelled, 1);
  assert.equal(singleChunk.body?.locked, false);

  const neverSettles = new Promise<void>(() => {});
  const stalledCancel = streamingRequest({
    chunks: [new Uint8Array(11)], headers: { "content-type": "application/octet-stream" },
    cancelResult: neverSettles,
  });
  await assert.rejects(() => readBoundedRequestBody(stalledCancel, 10), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE");
  assert.equal(stalledCancel.body?.locked, false);

  const readFailureBody = new ReadableStream<Uint8Array>({
    pull(controller) { controller.error(new Error("synthetic read failure")); },
  }, { highWaterMark: 0 });
  const readFailure = new Request("https://eu.example.test", {
    method: "POST", body: readFailureBody, duplex: "half",
  } as RequestInit & { duplex: "half" });
  await assert.rejects(() => readBoundedRequestBody(readFailure, 10), /synthetic read failure/);
  assert.equal(readFailure.body?.locked, false);
});

test("BKFC ingress rejects declared and undeclared oversized bodies without materialization", async () => {
  let earlyPulls = 0;
  const declaredOversized = streamingRequest({
    chunks: [new Uint8Array([1])],
    headers: ingressHeaders("multipart/form-data; boundary=test", 4_718_593),
    onPull: () => { earlyPulls += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(declaredOversized, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: allowPreparseQuota,
  }), (error: unknown) => error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE");
  assert.equal(earlyPulls, 0);

  const missingLengthHeaders = ingressHeaders("multipart/form-data; boundary=test", 1);
  delete (missingLengthHeaders as { "content-length"?: string })["content-length"];
  const missingLength = streamingRequest({
    chunks: [new Uint8Array(4_718_593)], headers: missingLengthHeaders,
    onPull: () => { earlyPulls += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(missingLength, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: allowPreparseQuota,
  }), (error: unknown) => error instanceof IntegrationError && error.code === "LENGTH_REQUIRED" && error.status === 411);
  assert.equal(earlyPulls, 0);

  let cancelled = 0;
  const deceptive = streamingRequest({
    chunks: [new Uint8Array(2_400_000), new Uint8Array(2_400_000)],
    headers: ingressHeaders("multipart/form-data; boundary=test", 1),
    onCancel: () => { cancelled += 1; },
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(deceptive, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: allowPreparseQuota,
  }), (error: unknown) => error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE" && error.status === 413);
  assert.equal(cancelled, 1);
});

test("bounded BKFC multipart parsing preserves a legitimate submission form", async () => {
  const form = new FormData();
  form.set("gymName", "Example Gym");
  const encoded = new Request("https://encoder.invalid", { method: "POST", body: form });
  const body = new Uint8Array(await encoded.arrayBuffer());
  const contentType = encoded.headers.get("content-type");
  assert.ok(contentType);
  const request = new Request("https://eu.example.test/api/v1/integrations/bkfc/affiliate-applications", {
    method: "POST", headers: ingressHeaders(contentType, body.byteLength), body,
  });
  const parsed = await parseBkfcSubmissionIngress(request, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: allowPreparseQuota,
  });
  assert.equal(parsed.form.get("gymName"), "Example Gym");
  assert.equal(parsed.authentication.authorized, true);

  const malformed = new Request("https://eu.example.test/api/v1/integrations/bkfc/affiliate-applications", {
    method: "POST",
    headers: ingressHeaders("multipart/form-data; boundary=test", 9),
    body: "malformed",
  });
  await assert.rejects(() => parseBkfcSubmissionIngress(malformed, {
    requestId: ingressRequestId, bearerSecrets: [currentSecret],
    consumePreparseQuota: allowPreparseQuota,
  }), (error: unknown) => error instanceof IntegrationError && error.code === "VALIDATION_FAILED" && error.status === 400);
});

test("durable pre-parser RPC is shared across independently created clients", async () => {
  let state: ReturnType<typeof consumeTokenBucket>["state"] | undefined;
  const databaseRpc = async () => {
    const result = consumeTokenBucket("submission_preparse", state, 0);
    state = result.state;
    return { data: [{ allowed: result.allowed, retry_after_seconds: result.retryAfterSeconds }], error: null };
  };
  const firstClient = { rpc: databaseRpc };
  const secondClient = { rpc: databaseRpc };
  const decisions = [];
  for (let index = 0; index < 11; index += 1) {
    decisions.push(await consumeSubmissionPreparseQuota(
      index % 2 === 0 ? firstClient : secondClient,
      "a".repeat(64),
    ));
  }
  assert.equal(decisions.filter((decision) => decision.allowed).length, 10);
  assert.deepEqual(decisions[10], { allowed: false, retryAfterSeconds: 1 });
});

test("durable pre-parser RPC fails closed on database and result-shape errors", async () => {
  const fingerprint = "a".repeat(64);
  const unavailable = { rpc: async () => ({ data: null, error: { message: "unavailable" } }) };
  await assert.rejects(() => consumeSubmissionPreparseQuota(unavailable, fingerprint), (error: unknown) =>
    error instanceof IntegrationError && error.code === "PERSISTENCE_UNAVAILABLE" &&
    error.status === 503 && error.retryAfterSeconds === SUBMISSION_PREPARSE_ENFORCEMENT_RETRY_SECONDS);

  for (const data of [null, [], [{ allowed: true }], [{ allowed: "yes", retry_after_seconds: 0 }],
    [{ allowed: true, retry_after_seconds: 1 }], [{ allowed: false, retry_after_seconds: 0 }],
    [{ allowed: false, retry_after_seconds: 61 }],
    [{ allowed: true, retry_after_seconds: 0, extra: true }],
    [{ allowed: true, retry_after_seconds: 0 }, { allowed: true, retry_after_seconds: 0 }]]) {
    await assert.rejects(() => consumeSubmissionPreparseQuota(
      { rpc: async () => ({ data, error: null }) }, fingerprint,
    ), (error: unknown) => error instanceof IntegrationError &&
      error.code === "PERSISTENCE_UNAVAILABLE" && error.retryAfterSeconds === 5);
  }
});

test("pre-parser enforcement failures read zero request-body bytes", async () => {
  for (const rpcResult of [
    { data: null, error: { message: "unavailable" } },
    { data: [{ allowed: true }], error: null },
  ]) {
    let pulls = 0;
    const request = streamingRequest({
      chunks: [new Uint8Array([1])],
      headers: ingressHeaders("multipart/form-data; boundary=test", 1),
      onPull: () => { pulls += 1; },
    });
    await assert.rejects(() => parseBkfcSubmissionIngress(request, {
      requestId: ingressRequestId,
      bearerSecrets: [currentSecret],
      consumePreparseQuota: (fingerprint) => consumeSubmissionPreparseQuota({
        rpc: async () => rpcResult,
      }, fingerprint),
    }), (error: unknown) => error instanceof IntegrationError &&
      error.code === "PERSISTENCE_UNAVAILABLE" && error.status === 503 &&
      error.retryAfterSeconds === 5);
    assert.equal(pulls, 0);
  }
});

test("rate-limit 429 response is exact", () => {
  const limited = new IntegrationError("RATE_LIMITED", 429, undefined, true, 7);
  assert.equal(limited.status, 429);
  assert.equal(integrationErrorHeaders(limited, "request-id")["retry-after"], "7");
  assert.deepEqual(integrationErrorPayload(limited, "request-id"), {
    success: false, code: "RATE_LIMITED", requestId: "request-id", retryable: true,
  });
});

function orphanDependencies(input: {
  createdAt: string;
  linked?: boolean;
  removalError?: boolean;
  referenceError?: boolean;
  objectCount?: number;
}) {
  const removed: string[][] = [];
  const logs: Array<Record<string, string | number | boolean>> = [];
  const objectCount = input.objectCount ?? 1;
  const dependencies: OrphanReconcilerDependencies = {
    list: async (prefix, options) => {
      if (!prefix) return options.offset === 0
        ? { data: [{ name: "1f8b7442-f45e-46da-ac1b-029d70f1b872" }], error: null }
        : { data: [], error: null };
      const objects = Array.from({ length: objectCount }, (_, index) => ({ name: `logo-${index}.png`, created_at: input.createdAt }));
      return { data: objects.slice(options.offset, options.offset + options.limit), error: null };
    },
    isLinked: async () => ({ data: input.linked ?? false, error: input.referenceError ? {} : null }),
    remove: async (paths) => { removed.push(paths); return { error: input.removalError ? {} : null }; },
    log: (event) => logs.push(event),
  };
  return { dependencies, removed, logs };
}

const reconciliationPolicy = { dryRun: true, batchSize: 10, minimumAgeHours: 24, maximumPages: 3 };

test("direct-upload orphan reconciliation is dry-run, age-safe, reference-safe and fail-closed", async () => {
  const old = orphanDependencies({ createdAt: "2026-08-23T23:59:59.999Z" });
  const dry = await reconcileBkfcIntegrationOrphans(old.dependencies, reconciliationPolicy, Date.parse("2026-08-25T00:00:00Z"));
  assert.equal(dry.eligible, 1); assert.equal(dry.removed, 0); assert.equal(old.removed.length, 0);

  const boundary = orphanDependencies({ createdAt: "2026-08-24T00:00:00.000Z" });
  assert.equal((await reconcileBkfcIntegrationOrphans(boundary.dependencies, reconciliationPolicy, Date.parse("2026-08-25T00:00:00Z"))).eligible, 0);

  const linked = orphanDependencies({ createdAt: "2026-08-23T00:00:00Z", linked: true });
  const linkedResult = await reconcileBkfcIntegrationOrphans(linked.dependencies, { ...reconciliationPolicy, dryRun: false }, Date.parse("2026-08-25T00:00:00Z"));
  assert.equal(linkedResult.protected, 1); assert.equal(linked.removed.length, 0);

  const failedCheck = orphanDependencies({ createdAt: "2026-08-23T00:00:00Z", referenceError: true });
  const failedResult = await reconcileBkfcIntegrationOrphans(failedCheck.dependencies, { ...reconciliationPolicy, dryRun: false }, Date.parse("2026-08-25T00:00:00Z"));
  assert.equal(failedResult.failures, 1); assert.equal(failedCheck.removed.length, 0);
});

test("orphan reconciliation bounds pagination and reports removal failures without path logs", async () => {
  const fixture = orphanDependencies({ createdAt: "2026-08-23T00:00:00Z", objectCount: 8, removalError: true });
  const result = await reconcileBkfcIntegrationOrphans(fixture.dependencies, {
    dryRun: false, batchSize: 3, minimumAgeHours: 24, maximumPages: 2,
  }, Date.parse("2026-08-25T00:00:00Z"));
  assert.equal(result.scanned, 3);
  assert.equal(result.failures, 3);
  assert.equal(fixture.removed.length, 3);
  assert.equal(JSON.stringify(fixture.logs).includes("logo-"), false);
});

test("replay logo cleanup preserves success while emitting a safe machine event on failure", async () => {
  const events: Array<{ stage: string; code: string; requestId: string }> = [];
  assert.equal(await removeUploadedLogo(async () => ({ error: {} }), (event) => events.push(event), "request-id"), false);
  assert.deepEqual(events, [{ stage: "submission_cleanup", code: "CLEANUP_FAILED", requestId: "request-id" }]);
  assert.equal(JSON.stringify(events).includes("filename"), false);
  assert.equal(await removeUploadedLogo(async () => ({ error: null }), (event) => events.push(event), "request-id"), true);
});

test("source configuration schedules delivery and routes reserve before expensive business work", async () => {
  const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
  assert.deepEqual(vercel.crons, [
    { path: "/api/cron/application-cleanup", schedule: "17 3 * * *" },
    { path: "/api/cron/bkfc-payment-commands", schedule: "* * * * *" },
    { path: "/api/cron/bkfc-gym-controls", schedule: "* * * * *" },
  ]);
  const sql = await readFile("supabase/migrations/20260825000000_bkfc_eu_affiliate_integration_v1.sql", "utf8");
  const reserveStart = sql.indexOf("create or replace function public.reserve_bkfc_integration_ingress_v1");
  const reserveEnd = sql.indexOf("create or replace function public.finalize_bkfc_integration_ingress_reservation_v1");
  const reserveFunction = sql.slice(reserveStart, reserveEnd);
  assert.ok(reserveFunction.indexOf("from public.affiliate_applications") <
    reserveFunction.indexOf("consume_bkfc_integration_rate_limit_v1"));
  assert.match(reserveFunction, /return query select 'rate_limited'/);
  const createStart = sql.indexOf("create or replace function public.create_bkfc_affiliate_application_v1");
  const createEnd = sql.indexOf("create or replace function public.admin_transition_affiliate_application", createStart);
  assert.doesNotMatch(sql.slice(createStart, createEnd), /consume_bkfc_integration_rate_limit_v1/);
  const callbackStart = sql.indexOf("create or replace function public.record_bkfc_payment_status_event_v1");
  const callbackEnd = sql.indexOf("alter table public.affiliate_application_payment_coordination enable row level security", callbackStart);
  assert.doesNotMatch(sql.slice(callbackStart, callbackEnd), /consume_bkfc_integration_rate_limit_v1/);

  const submissionRoute = await readFile("app/api/v1/integrations/bkfc/affiliate-applications/route.ts", "utf8");
  const submissionReserve = submissionRoute.indexOf("await reserveIngress");
  assert.ok(submissionRoute.indexOf("await parseBkfcSubmissionIngress") <
    submissionRoute.indexOf("await validateBkfcSubmission"));
  assert.ok(submissionReserve > submissionRoute.indexOf("validateBkfcSubmission"));
  assert.ok(submissionReserve < submissionRoute.indexOf("normalized_gym_name"));
  assert.ok(submissionReserve < submissionRoute.indexOf(".upload("));
  assert.ok(submissionReserve < submissionRoute.indexOf("create_bkfc_affiliate_application_v1"));
  assert.match(submissionRoute, /p_idempotency_key: reservation\.logical_request_id/);

  const callbackRoute = await readFile(
    "app/api/v1/integrations/bkfc/affiliate-applications/[euApplicationId]/payment-status-events/route.ts",
    "utf8",
  );
  assert.ok(callbackRoute.indexOf("const { data: existing") < callbackRoute.indexOf("await reserveIngress"));
  assert.ok(callbackRoute.indexOf(".maybeSingle()") < callbackRoute.indexOf("await reserveIngress"));
  assert.ok(callbackRoute.indexOf("await reserveIngress") <
    callbackRoute.indexOf("record_bkfc_payment_status_event_v1"));
});

test("pre-parser quota migration and route expose only the narrow durable boundary", async () => {
  const sql = await readFile(
    "supabase/migrations/20260826000000_bkfc_submission_preparse_quota.sql",
    "utf8",
  );
  assert.match(sql, /direction in \('submission_preparse', 'submission', 'callback'\)/);
  assert.match(sql, /if p_direction in \('submission_preparse', 'submission'\)[\s\S]*v_capacity := 10;[\s\S]*v_refill_per_second := 1;/);
  assert.match(sql, /for update;[\s\S]*v_now := pg_catalog\.clock_timestamp\(\);[\s\S]*v_available := least/);
  const wrapperStart = sql.indexOf(
    "create or replace function public.consume_bkfc_submission_preparse_rate_limit_v1",
  );
  const wrapperEnd = sql.indexOf("revoke all on function", wrapperStart);
  const wrapper = sql.slice(wrapperStart, wrapperEnd);
  assert.match(wrapper, /returns table\(allowed boolean, retry_after_seconds integer\)/);
  assert.match(wrapper, /security definer[\s\S]*set search_path = pg_catalog/);
  assert.match(wrapper, /consume_bkfc_integration_rate_limit_v1\(\s*'submission_preparse'/);
  assert.doesNotMatch(wrapper, /p_direction/);
  assert.match(sql, /revoke all on function public\.consume_bkfc_integration_rate_limit_v1\(text, text\)[\s\S]*service_role/);
  assert.match(sql, /revoke all on table public\.bkfc_integration_rate_limit_buckets[\s\S]*service_role/);
  assert.match(sql, /grant execute on function public\.consume_bkfc_submission_preparse_rate_limit_v1\(text\)[\s\S]*to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.consume_bkfc_integration_rate_limit_v1/);

  const ingress = await readFile("lib/integrations/bkfc/submission-ingress.ts", "utf8");
  assert.doesNotMatch(ingress, /new Map|createCredentialRateLimiter/);
  assert.ok(ingress.indexOf("const authentication = authenticateBearer") <
    ingress.indexOf("consumePreparseQuota(authentication.credentialFingerprint)"));
  assert.ok(ingress.indexOf("consumePreparseQuota(authentication.credentialFingerprint)") <
    ingress.indexOf("parseBoundedMultipart(request, contentType)"));

  const route = await readFile("app/api/v1/integrations/bkfc/affiliate-applications/route.ts", "utf8");
  const post = route.slice(route.indexOf("export async function POST"));
  assert.ok(post.indexOf("getBkfcIntegrationConfig") < post.indexOf("parseBkfcSubmissionIngress"));
  assert.ok(post.indexOf("consumeSubmissionPreparseQuota") < post.indexOf("validateBkfcSubmission"));
  assert.ok(post.indexOf("validateBkfcSubmission") < post.indexOf("reserveIngress"));
});

test("payment-cycle migration isolates every stale command and callback from the current request", async () => {
  const sql = await readFile(
    "supabase/migrations/20260826010000_bkfc_payment_cycle_isolation.sql",
    "utf8",
  );
  for (const reconciliation of [
    "PAYMENT_RECONCILIATION_MISSING_CURRENT_POINTER",
    "PAYMENT_RECONCILIATION_NON_INITIATION_CURRENT_POINTER",
    "PAYMENT_RECONCILIATION_CROSS_APPLICATION_CURRENT_POINTER",
    "PAYMENT_RECONCILIATION_INVALID_COMMAND_REQUEST_LINK",
    "PAYMENT_RECONCILIATION_INVALID_EVENT_REQUEST_LINK",
    "PAYMENT_RECONCILIATION_DUPLICATE_CANCELLATIONS",
    "PAYMENT_RECONCILIATION_AMBIGUOUS_PENDING_NONAPPROVED",
    "PAYMENT_RECONCILIATION_INVALID_CURRENT_EVENT_LINK",
  ]) assert.match(sql, new RegExp(reconciliation));
  assert.match(sql, /unique \(command_id, application_id\)/);
  assert.match(sql, /foreign key \(payment_request_id, application_id\)/);
  assert.match(sql, /foreign key \(current_payment_request_id, application_id\)/);
  assert.match(sql, /foreign key \(last_status_event_id, application_id, current_payment_request_id\)/);
  assert.match(sql, /Payment request must reference a same-application initiation/);
  assert.match(sql, /'superseded_payment_request'/);

  const transitionStart = sql.indexOf("create or replace function public.admin_transition_affiliate_application");
  const staffStart = sql.indexOf("create or replace function public.admin_create_affiliate_payment_request");
  const transition = sql.slice(transitionStart, staffStart);
  assert.match(transition, /payment_status = 'pending' and v_cancellation_activity/);
  assert.match(transition, /\('approved', 'approved'\), \('activated_affiliate', 'active'\)/);
  assert.match(transition, /create_bkfc_payment_initiation_cycle_v2/);
  assert.match(transition, /current_payment_request_id = v_initiation\.payment_request_id/);
  assert.match(sql, /current_payment_request_id = v_payment_request_id[\s\S]*last_status_event_id = null/);
  assert.match(sql, /PAYMENT_CYCLE_STILL_ACTIVE/);

  const confirmationStart = sql.indexOf("create or replace function public.confirm_affiliate_payment_command_transmission");
  const completionStart = sql.indexOf("create or replace function public.complete_affiliate_payment_command_delivery");
  const callbackStart = sql.indexOf("create or replace function public.record_bkfc_payment_status_event_v1");
  const confirmation = sql.slice(confirmationStart, completionStart);
  assert.match(confirmation, /command_type = 'payment_cancellation' then return true/);
  assert.match(confirmation, /current_payment_request_id = v_command\.payment_request_id/);

  const completion = sql.slice(completionStart, callbackStart);
  const coordinationUpdates = completion
    .split("update public.affiliate_application_payment_coordination")
    .slice(1)
    .map((segment) => segment.slice(0, segment.indexOf(";")));
  assert.ok(coordinationUpdates.length >= 6);
  for (const update of coordinationUpdates) {
    assert.match(update, /current_payment_request_id = v_command\.payment_request_id/);
  }

  const callback = sql.slice(callbackStart, sql.indexOf("alter table public.affiliate_application_payment_coordination enable", callbackStart));
  assert.match(callback, /if not v_current then\s+v_not_applied := 'superseded_payment_request'/);
  assert.match(callback, /where application_id = p_application_id\s+and current_payment_request_id = p_payment_request_id/);
  assert.doesNotMatch(callback, /p_event_type in \('payment_link_sent', 'payment_initiation_failed'\) and not v_current/);

  assert.match(sql, /security definer\s+set search_path = pg_catalog/g);
  assert.match(sql, /revoke all on function public\.create_bkfc_payment_initiation_cycle_v2[\s\S]*service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.create_bkfc_payment_initiation_cycle_v2/);

  const worker = await readFile("lib/integrations/bkfc/payment-command-worker.ts", "utf8");
  assert.doesNotMatch(worker, /if \(command\.command_type === "payment_initiation"\)/);
  assert.ok(worker.indexOf("confirm_affiliate_payment_command_transmission") <
    worker.indexOf("deliverPaymentCommand(command"));
  assert.ok(worker.indexOf("if (mayTransmit !== true)") <
    worker.indexOf("deliverPaymentCommand(command"));
});

function reservation(disposition: IngressReservation["disposition"], overrides: Partial<IngressReservation> = {}): IngressReservation {
  return {
    disposition,
    reservation_id: disposition === "acquired" ? "reservation-id" : null,
    claim_token: disposition === "acquired" ? "claim-token" : null,
    logical_request_id: "logical-id",
    reserved_application_id: null,
    reserved_application_reference: null,
    outcome_code: null,
    retry_after_seconds: 0,
    ...overrides,
  };
}

test("reservation dispositions gate duplicate lookup, upload and business creation", () => {
  const expensive = { duplicate: 0, upload: 0, create: 0 };
  const proceed = (value: IngressReservation) => {
    if (value.disposition === "completed") return "replay";
    requireAcquiredReservation(value);
    expensive.duplicate += 1;
    expensive.upload += 1;
    expensive.create += 1;
    return "created";
  };

  assert.throws(() => proceed(reservation("rate_limited", { retry_after_seconds: 3 })), (error: unknown) =>
    error instanceof IntegrationError && error.code === "RATE_LIMITED" && error.status === 429 &&
    error.retryable && error.retryAfterSeconds === 3);
  assert.deepEqual(expensive, { duplicate: 0, upload: 0, create: 0 });
  assert.throws(() => proceed(reservation("in_progress", { retry_after_seconds: 9 })), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUEST_IN_PROGRESS" && error.status === 409 &&
    error.retryable && error.retryAfterSeconds === 9);
  assert.deepEqual(expensive, { duplicate: 0, upload: 0, create: 0 });
  assert.equal(proceed(reservation("completed")), "replay");
  assert.deepEqual(expensive, { duplicate: 0, upload: 0, create: 0 });
  assert.throws(() => proceed(reservation("idempotency_conflict")), (error: unknown) =>
    error instanceof IntegrationError && error.code === "IDEMPOTENCY_CONFLICT");
  assert.throws(() => proceed(reservation("source_conflict")), (error: unknown) =>
    error instanceof IntegrationError && error.code === "BKFC_APPLICATION_ID_CONFLICT");
  assert.deepEqual(expensive, { duplicate: 0, upload: 0, create: 0 });
  assert.equal(proceed(reservation("acquired")), "created");
  assert.deepEqual(expensive, { duplicate: 1, upload: 1, create: 1 });
});

test("reservation RPCs fail closed, preserve fingerprints and finalize explicit lifecycle outcomes", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const rpcClient = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      if (name.startsWith("reserve_")) return { data: [reservation("acquired")], error: null };
      return { data: true, error: null };
    },
  };
  const acquired = await reserveIngress(rpcClient, {
    direction: "callback", logicalRequestId: "event-id", sourceApplicationId: "BKFC-1",
    payloadHash: "a".repeat(64), credentialFingerprint: "b".repeat(64),
    euApplicationId: "application-id", paymentRequestId: "payment-id",
  });
  assert.equal(acquired.disposition, "acquired");
  assert.equal(calls[0].args.p_credential_fingerprint, "b".repeat(64));
  assert.equal(JSON.stringify(calls).includes(currentSecret), false);
  await finalizeIngressReservation(rpcClient, {
    reservationId: "reservation-id", claimToken: "claim-token", payloadHash: "a".repeat(64),
    outcomeCode: "APPLICATION_NOT_FOUND", terminal: true,
  });
  assert.deepEqual(calls[1], {
    name: "finalize_bkfc_integration_ingress_reservation_v1",
    args: {
      p_reservation_id: "reservation-id", p_claim_token: "claim-token",
      p_payload_hash: "a".repeat(64), p_outcome_code: "APPLICATION_NOT_FOUND", p_terminal: true,
    },
  });

  await assert.rejects(() => reserveIngress({
    rpc: async () => ({ data: null, error: { message: "raw provider prose" } }),
  }, {
    direction: "submission", logicalRequestId: "logical", sourceApplicationId: "BKFC-2",
    payloadHash: "c".repeat(64), credentialFingerprint: "d".repeat(64),
  }), (error: unknown) => error instanceof IntegrationError && error.code === "PERSISTENCE_UNAVAILABLE");
});

test("migration scopes payment behavior to valid BKFC identity and enforces durable limits", async () => {
  const sql = await readFile("supabase/migrations/20260825000000_bkfc_eu_affiliate_integration_v1.sql", "utf8");
  const start = sql.indexOf("create or replace function public.admin_transition_affiliate_application");
  const end = sql.indexOf("create or replace function public.admin_create_affiliate_payment_request", start);
  const transition = sql.slice(start, end);
  assert.match(transition, /v_is_bkfc := v_application\.source_system = 'bkfc'[\s\S]*source_application_id is not null/);
  assert.match(transition, /if v_is_bkfc and p_review_stage = 'approved'/);
  assert.match(transition, /if v_is_bkfc and p_review_stage = 'activated_affiliate'/);
  assert.match(transition, /if v_is_bkfc[\s\S]*v_application\.review_stage = 'approved'/);
  assert.match(sql, /enforce_affiliate_payment_command_bkfc_identity/);
  assert.match(sql, /consume_bkfc_integration_rate_limit_v1/);
  assert.match(sql, /pg_advisory_xact_lock[\s\S]*5 - v_active[\s\S]*floor\(v_tokens\)/);
  assert.match(sql, /bkfc_integration_rate_limit_buckets enable row level security/);
  assert.match(sql, /revoke all on table public\.bkfc_integration_rate_limit_buckets from public, anon, authenticated/);
  assert.match(sql, /revoke all on table public\.bkfc_integration_rate_limit_buckets from service_role/);
  assert.match(sql, /revoke all on table public\.bkfc_integration_ingress_reservations from service_role/);
  assert.doesNotMatch(sql, /grant [^;]*bkfc_integration_rate_limit_buckets to service_role/);
  assert.doesNotMatch(sql, /grant execute on function public\.consume_bkfc_integration_rate_limit_v1/);
});
