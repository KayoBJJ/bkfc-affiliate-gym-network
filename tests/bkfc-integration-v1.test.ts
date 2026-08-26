import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { bearerAuthorized } from "../lib/integrations/bkfc/auth.ts";
import { canonicalJson, canonicalSha256 } from "../lib/integrations/bkfc/canonical-json.ts";
import {
  BKFC_PAYMENT_RESPONSE_MAX_BYTES, deliverPaymentCommand, paymentCommandUrl, type PaymentCommand,
} from "../lib/integrations/bkfc/payment-command-transport.ts";
import { validatePaymentStatusEvent } from "../lib/integrations/bkfc/payment-status.ts";
import {
  BKFC_LOGO_MAX_BYTES, validateBkfcSubmission,
} from "../lib/integrations/bkfc/submission.ts";
import { IntegrationError, parseRequiredContentLength } from "../lib/integrations/bkfc/contracts.ts";
import { ConfigurationError, resolveBkfcIntegrationConfig } from "../lib/config/policy.ts";

const applicationId = "1f8b7442-f45e-46da-ac1b-029d70f1b872";
const paymentRequestId = "4fd6e3c8-9620-44f0-96c9-e2b0dddb3102";
const eventId = "06691530-155f-46dd-930b-a32618aed301";
const requestId = "6f314ad6-8d2f-4eb0-9df8-a6c1b547d88f";
const idempotencyKey = "58b3b08f-582f-4a1a-a11b-30b738532a23";
const currentSecret = "Abcdefghijklmnopqrstuvwxyz0123456789-ABCDEFGHIJK";
const outgoingSecret = "ZYXWVUTSRQPONMLKJIHGFEDCBA9876543210-abcdefghijk";

function png(name = "logo.png", size = 32, type = "image/png") {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type });
}

function validSubmissionForm() {
  const form = new FormData();
  form.set("gymName", "  Example\u00a0 Gym ");
  form.set("contactPerson", "Approved Recipient");
  form.set("address", "1 Example Street");
  form.set("city", "Sofia");
  form.set("state", "Sofia City");
  form.set("postalCode", "1000");
  form.set("country", "Bulgaria");
  form.set("email", "OWNER@EXAMPLE.COM");
  form.set("phone", "+359 88 123 4567");
  form.set("website", "https://example.com/gym");
  form.set("instagram", "@example.gym");
  form.set("disciplinesOffered", " Boxing, Brazilian   Jiu-Jitsu;\nMMA ");
  form.set("promoVideoLink", "https://video.example.com/watch/1");
  form.set("plan", "monthly");
  form.set("reviewConsent", "on");
  form.set("consentNoticeVersion", "eu-bkfc-v1");
  form.set("logoUpload", png());
  return form;
}

async function submission(form = validSubmissionForm()) {
  return validateBkfcSubmission({
    form, bkfcApplicationId: "BKFC-APP-000123", idempotencyKey, requestId,
    consentNoticeVersionAllowlist: new Set(["eu-bkfc-v1"]),
  });
}

async function rejectsCode(run: () => unknown | Promise<unknown>, code: string, field?: string) {
  await assert.rejects(async () => run(), (error: unknown) => {
    assert.ok(error instanceof IntegrationError);
    assert.equal(error.code, code);
    if (field) assert.equal(error.field, field);
    return true;
  });
}

test("all BKFC integration feature flags fail closed and enabled directions validate configuration", () => {
  const disabled = resolveBkfcIntegrationConfig({});
  assert.equal(disabled.submissionEnabled, false);
  assert.equal(disabled.paymentCallbackEnabled, false);
  assert.equal(disabled.paymentDeliveryEnabled, false);
  assert.throws(() => resolveBkfcIntegrationConfig({ BKFC_SUBMISSION_INTEGRATION_ENABLED: "truthy" }), ConfigurationError);
  assert.throws(() => resolveBkfcIntegrationConfig({ BKFC_SUBMISSION_INTEGRATION_ENABLED: "true" }), ConfigurationError);
  const enabled = resolveBkfcIntegrationConfig({
    BKFC_SUBMISSION_INTEGRATION_ENABLED: "true",
    BKFC_PAYMENT_CALLBACK_ENABLED: "true",
    BKFC_PAYMENT_REQUEST_DELIVERY_ENABLED: "true",
    BKFC_TO_EU_BEARER_SECRET_CURRENT: currentSecret,
    EU_TO_BKFC_BEARER_SECRET_CURRENT: outgoingSecret,
    BKFC_PAYMENT_REQUEST_BASE_URL: "https://bkfc.example.test",
    BKFC_CONSENT_NOTICE_VERSION_ALLOWLIST: "eu-bkfc-v1,eu-bkfc-v1.1",
  });
  assert.equal(enabled.submissionEnabled, true);
  assert.equal(enabled.consentNoticeVersionAllowlist.has("eu-bkfc-v1"), true);
  assert.throws(() => resolveBkfcIntegrationConfig({
    BKFC_PAYMENT_REQUEST_DELIVERY_ENABLED: "true",
    EU_TO_BKFC_BEARER_SECRET_CURRENT: outgoingSecret,
    BKFC_PAYMENT_REQUEST_BASE_URL: "https://user:pass@bkfc.example.test/path",
  }), ConfigurationError);
  for (const unsafeBaseUrl of [
    "https://localhost", "https://localhost.", "https://api.localhost", "https://api.localhost.",
    "https://127.0.0.1", "https://0x7f000001",
    "https://10.0.0.1", "https://169.254.169.254", "https://192.168.1.1", "https://[::1]", "https://[fc00::1]",
  ]) {
    assert.throws(() => resolveBkfcIntegrationConfig({
      BKFC_PAYMENT_REQUEST_DELIVERY_ENABLED: "true",
      EU_TO_BKFC_BEARER_SECRET_CURRENT: outgoingSecret,
      BKFC_PAYMENT_REQUEST_BASE_URL: unsafeBaseUrl,
    }), ConfigurationError);
  }
  assert.equal(resolveBkfcIntegrationConfig({
    BKFC_PAYMENT_REQUEST_DELIVERY_ENABLED: "true",
    EU_TO_BKFC_BEARER_SECRET_CURRENT: outgoingSecret,
    BKFC_PAYMENT_REQUEST_BASE_URL: "https://203.0.113.10",
  }).paymentRequestBaseUrl, "https://203.0.113.10");
});

test("directional bearer authentication accepts current/previous slots and rejects malformed values", () => {
  assert.equal(bearerAuthorized(`Bearer ${currentSecret}`, [currentSecret, outgoingSecret]), true);
  assert.equal(bearerAuthorized(`Bearer ${outgoingSecret}`, [currentSecret, outgoingSecret]), true);
  assert.equal(bearerAuthorized(`bearer ${currentSecret}`, [currentSecret]), false);
  assert.equal(bearerAuthorized(null, [currentSecret]), false);
  assert.equal(bearerAuthorized(`Bearer ${currentSecret}x`, [currentSecret]), false);
});

test("required Content-Length is strict and enforces the complete request bound", () => {
  assert.throws(() => parseRequiredContentLength(new Headers(), 100), (error: unknown) =>
    error instanceof IntegrationError && error.code === "LENGTH_REQUIRED" && error.status === 411);
  assert.throws(() => parseRequiredContentLength(new Headers({ "content-length": "0" }), 100), IntegrationError);
  assert.equal(parseRequiredContentLength(new Headers({ "content-length": "100" }), 100), 100);
  assert.throws(() => parseRequiredContentLength(new Headers({ "content-length": "101" }), 100), (error: unknown) =>
    error instanceof IntegrationError && error.code === "REQUEST_TOO_LARGE" && error.status === 413);
});

test("multipart validation normalizes disciplines after splitting and builds the frozen canonical hash", async () => {
  const result = await submission();
  assert.equal(result.gymName, "Example Gym");
  assert.equal(result.email, "owner@example.com");
  assert.deepEqual(result.disciplines, ["Boxing", "Brazilian Jiu-Jitsu", "MMA"]);
  assert.equal(result.instagram, "https://www.instagram.com/example.gym/");
  assert.equal(result.payloadHash, canonicalSha256(result.canonicalPayload));
  assert.match(result.logo.sha256, /^[a-f0-9]{64}$/);
  assert.equal(canonicalJson({ z: 1, a: { y: true, x: null } }), '{"a":{"x":null,"y":true},"z":1}');
});

test("canonical submission identity ignores filename but detects text, logo and BKFC identity changes", async () => {
  const first = await submission();
  const renamed = validSubmissionForm();
  renamed.set("logoUpload", png("renamed-identical-logo.png"));
  assert.equal((await submission(renamed)).payloadHash, first.payloadHash);
  const changedText = validSubmissionForm();
  changedText.set("city", "Plovdiv");
  assert.notEqual((await submission(changedText)).payloadHash, first.payloadHash);
  const changedLogo = validSubmissionForm();
  const bytes = new Uint8Array(32); bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); bytes[31] = 1;
  changedLogo.set("logoUpload", new File([bytes], "logo.png", { type: "image/png" }));
  assert.notEqual((await submission(changedLogo)).payloadHash, first.payloadHash);
  const changedIdentity = await validateBkfcSubmission({
    form: validSubmissionForm(), bkfcApplicationId: "BKFC-APP-000124", idempotencyKey, requestId,
    consentNoticeVersionAllowlist: new Set(["eu-bkfc-v1"]),
  });
  assert.notEqual(changedIdentity.payloadHash, first.payloadHash);
});

test("multipart allowlist, consent, plan, exact-one-logo, size, MIME and signature rules are strict", async () => {
  const unknown = validSubmissionForm(); unknown.set("gymPhotos", "forbidden");
  await rejectsCode(() => submission(unknown), "UNEXPECTED_FIELD", "gymPhotos");
  const fighter = validSubmissionForm(); fighter.set("fighterListUpload", "forbidden");
  await rejectsCode(() => submission(fighter), "UNEXPECTED_FIELD", "fighterListUpload");
  const missingConsent = validSubmissionForm(); missingConsent.delete("reviewConsent");
  await rejectsCode(() => submission(missingConsent), "INVALID_CONSENT", "reviewConsent");
  const invalidPlan = validSubmissionForm(); invalidPlan.set("plan", "annual");
  await rejectsCode(() => submission(invalidPlan), "INVALID_PLAN", "plan");
  const duplicate = validSubmissionForm(); duplicate.append("logoUpload", png("second.png"));
  await rejectsCode(() => submission(duplicate), "VALIDATION_FAILED", "logoUpload");
  const oversized = validSubmissionForm(); oversized.set("logoUpload", png("large.png", BKFC_LOGO_MAX_BYTES + 1));
  await rejectsCode(() => submission(oversized), "FILE_TOO_LARGE", "logoUpload");
  const mime = validSubmissionForm(); mime.set("logoUpload", png("logo.png", 32, "image/jpeg"));
  await rejectsCode(() => submission(mime), "INVALID_FILE_SIGNATURE", "logoUpload");
  const signature = validSubmissionForm(); signature.set("logoUpload", new File(["not png"], "logo.png", { type: "image/png" }));
  await rejectsCode(() => submission(signature), "INVALID_FILE_SIGNATURE", "logoUpload");
});

function paymentEvent(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 1, eventId, paymentRequestId, bkfcApplicationId: "BKFC-APP-000123",
    euApplicationId: applicationId, eventType: "payment_paid",
    occurredAt: "2026-08-24T13:45:01.123456Z", reasonCode: null, ...overrides,
  };
}

test("payment callbacks validate exact correlation and produce replay/conflict hashes", () => {
  const now = new Date("2026-08-25T00:00:00.000Z");
  const first = validatePaymentStatusEvent(paymentEvent(), applicationId, now);
  const replay = validatePaymentStatusEvent(paymentEvent(), applicationId, now);
  assert.equal(first.payloadHash, replay.payloadHash);
  assert.equal(first.occurredAt, "2026-08-24T13:45:01.123Z");
  const conflict = validatePaymentStatusEvent(paymentEvent({ eventType: "payment_refunded" }), applicationId, now);
  assert.notEqual(first.payloadHash, conflict.payloadHash);
  assert.throws(() => validatePaymentStatusEvent(paymentEvent({ euApplicationId: requestId }), applicationId, now),
    (error: unknown) => error instanceof IntegrationError && error.code === "CORRELATION_CONFLICT");
  assert.throws(() => validatePaymentStatusEvent(paymentEvent({ stripePaymentIntentId: "pi_secret" }), applicationId, now),
    (error: unknown) => error instanceof IntegrationError && error.code === "UNEXPECTED_FIELD");
});

function command(type: PaymentCommand["command_type"] = "payment_initiation"): PaymentCommand {
  const commandId = type === "payment_initiation" ? paymentRequestId : eventId;
  return {
    command_id: commandId, application_id: applicationId, command_type: type,
    payment_request_id: paymentRequestId, idempotency_key: idempotencyKey,
    payload: type === "payment_initiation"
      ? { contractVersion: 1, paymentRequestId, euApplicationId: applicationId }
      : { contractVersion: 1, cancellationId: commandId, paymentRequestId, euApplicationId: applicationId },
    payload_hash: "a".repeat(64), attempt_count: 1, claim_token: requestId,
  };
}

test("worker uses fixed safe targets and retries retain command identity/body while request IDs rotate", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init! });
    return new Response(JSON.stringify({ success: false, code: "DELIVERY_UNAVAILABLE" }), {
      status: 503, headers: { "content-type": "application/json", "retry-after": "120" },
    });
  };
  const first = await deliverPaymentCommand(command(), { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, fetchMock,
    new Date("2026-08-25T10:00:00.000Z"));
  const second = await deliverPaymentCommand(command(), { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, fetchMock,
    new Date("2026-08-25T10:00:00.000Z"));
  assert.equal(first.disposition, "retry");
  assert.equal(first.nextAttemptAt, "2026-08-25T10:02:00.000Z");
  assert.equal(calls[0].url, `https://bkfc.example.test/api/v1/integrations/eu/affiliate-applications/${applicationId}/payment-requests`);
  assert.equal(calls[0].init.body, calls[1].init.body);
  assert.equal(calls[0].init.redirect, "manual");
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"), idempotencyKey);
  assert.notEqual(new Headers(calls[0].init.headers).get("x-request-id"), new Headers(calls[1].init.headers).get("x-request-id"));
  assert.equal(String(calls[0].init.body).includes(outgoingSecret), false);
  assert.notEqual(first.requestId, second.requestId);
});

test("payment transport rejects unsafe direct destinations before invoking fetch", async () => {
  let invoked = false;
  const result = await deliverPaymentCommand(command(),
    { baseUrl: "https://localhost./", bearerSecret: outgoingSecret },
    async () => { invoked = true; return new Response(null, { status: 202 }); });
  assert.equal(invoked, false);
  assert.equal(result.disposition, "retry");
  assert.equal(result.errorCode, "NETWORK_ERROR");
});

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

test("payment delivery never follows same-origin or cross-origin redirects", async (t) => {
  let redirectDestinationRequests = 0;
  let redirectDestinationBytes = 0;
  const destination = createServer((request, response) => {
    redirectDestinationRequests += 1;
    request.on("data", (chunk: Buffer) => { redirectDestinationBytes += chunk.length; });
    request.on("end", () => { response.writeHead(202).end(); });
  });
  const destinationOrigin = await listen(destination);
  t.after(() => destination.close());

  let sourceRequests = 0;
  const receivedBodies: string[] = [];
  const source = createServer((request, response) => {
    sourceRequests += 1;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      receivedBodies.push(Buffer.concat(chunks).toString("utf8"));
      const requestUrl = new URL(request.url ?? "/", "http://source.test");
      if (requestUrl.pathname === "/accepted") {
        response.writeHead(202, { "content-type": "application/json" }).end(JSON.stringify({ data: { outcome: "requested" } }));
        return;
      }
      const status = Number(requestUrl.searchParams.get("status"));
      const location = requestUrl.searchParams.get("target") === "same" ? "/redirect-destination" : `${destinationOrigin}/redirect-destination`;
      response.writeHead(status, { location }).end();
    });
  });
  const sourceOrigin = await listen(source);
  t.after(() => source.close());

  const sensitiveCommand = command();
  sensitiveCommand.payload = {
    contractVersion: 1,
    paymentRequestId,
    euApplicationId: applicationId,
    applicantEmail: "applicant-sensitive@example.test",
  };
  const transport = (path: string): typeof fetch => async (_input, init) => fetch(`${sourceOrigin}${path}`, init);
  const accepted = await deliverPaymentCommand(sensitiveCommand,
    { baseUrl: "https://approved-bkfc.example.test", bearerSecret: outgoingSecret }, transport("/accepted"));
  assert.equal(accepted.disposition, "accepted");
  assert.equal(sourceRequests, 1);
  assert.equal(receivedBodies[0], canonicalJson(sensitiveCommand.payload));

  for (const target of ["same", "cross"] as const) {
    for (const status of [301, 302, 303, 307, 308]) {
      const result = await deliverPaymentCommand(sensitiveCommand,
        { baseUrl: "https://approved-bkfc.example.test", bearerSecret: outgoingSecret },
        transport(`/redirect?status=${status}&target=${target}`));
      assert.deepEqual({ disposition: result.disposition, status: result.httpStatus, code: result.errorCode },
        { disposition: "intervention", status, code: `HTTP_${status}` });
      assert.equal(JSON.stringify(result).includes(outgoingSecret), false);
      assert.equal(JSON.stringify(result).includes("applicant-sensitive@example.test"), false);
    }
  }
  assert.equal(sourceRequests, 11);
  assert.equal(redirectDestinationRequests, 0);
  assert.equal(redirectDestinationBytes, 0);
});

function streamingResponse(input: {
  chunks: Uint8Array[];
  status: number;
  headers?: HeadersInit;
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
  return new Response(body, { status: input.status, headers: input.headers });
}

test("payment responses are bounded before JSON parsing without changing status semantics", async () => {
  const encoder = new TextEncoder();
  const valid = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(JSON.stringify({ data: { outcome: "requested" } }), { status: 202 }));
  assert.equal(valid.disposition, "accepted");
  assert.equal(valid.outcome, "requested");

  let declaredPulls = 0;
  let declaredCancels = 0;
  const declaredOversized = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: [encoder.encode("private partner response")], status: 202,
      headers: { "content-length": String(BKFC_PAYMENT_RESPONSE_MAX_BYTES + 1) },
      onPull: () => { declaredPulls += 1; }, onCancel: () => { declaredCancels += 1; },
    }));
  assert.deepEqual({ disposition: declaredOversized.disposition, code: declaredOversized.errorCode },
    { disposition: "intervention", code: "RESPONSE_TOO_LARGE" });
  assert.equal(declaredPulls, 0);
  assert.equal(declaredCancels, 1);

  const neverSettles = new Promise<void>(() => {});
  const declaredWithStalledCancel = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: [encoder.encode("not retained")], status: 202,
      headers: { "content-length": String(BKFC_PAYMENT_RESPONSE_MAX_BYTES + 1) },
      cancelResult: neverSettles,
    }));
  assert.equal(declaredWithStalledCancel.errorCode, "RESPONSE_TOO_LARGE");

  let streamedPulls = 0;
  let streamedCancels = 0;
  const largeChunk = new Uint8Array(4_096);
  let streamedResponse: Response | undefined;
  const streamedOversized = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => {
      streamedResponse = streamingResponse({
        chunks: Array.from({ length: 2_048 }, () => largeChunk), status: 202,
        headers: { "content-length": "1" },
        onPull: () => { streamedPulls += 1; }, onCancel: () => { streamedCancels += 1; },
      });
      return streamedResponse;
    });
  assert.equal(streamedOversized.disposition, "intervention");
  assert.equal(streamedOversized.errorCode, "RESPONSE_TOO_LARGE");
  assert.equal(streamedPulls, 5);
  assert.equal(streamedCancels, 1);
  assert.equal(streamedResponse?.body?.locked, false);
  assert.equal(JSON.stringify(streamedOversized).includes("private partner response"), false);

  let stalledStreamResponse: Response | undefined;
  const streamedWithStalledCancel = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => {
      stalledStreamResponse = streamingResponse({
        chunks: [new Uint8Array(BKFC_PAYMENT_RESPONSE_MAX_BYTES + 1)], status: 202,
        cancelResult: neverSettles,
      });
      return stalledStreamResponse;
    });
  assert.equal(streamedWithStalledCancel.errorCode, "RESPONSE_TOO_LARGE");
  assert.equal(stalledStreamResponse?.body?.locked, false);

  const rejectingCancel = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: [new Uint8Array(BKFC_PAYMENT_RESPONSE_MAX_BYTES + 1)], status: 202,
      cancelResult: Promise.reject(new Error("synthetic response cancellation failure")),
    }));
  assert.equal(rejectingCancel.errorCode, "RESPONSE_TOO_LARGE");

  let absentLengthPulls = 0;
  const absentLength = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: Array.from({ length: 2_048 }, () => largeChunk), status: 202,
      onPull: () => { absentLengthPulls += 1; },
    }));
  assert.equal(absentLength.errorCode, "RESPONSE_TOO_LARGE");
  assert.equal(absentLengthPulls, 5);

  const emptyObjectLength = encoder.encode(JSON.stringify({ padding: "" })).byteLength;
  const exactBody = encoder.encode(JSON.stringify({
    padding: "x".repeat(BKFC_PAYMENT_RESPONSE_MAX_BYTES - emptyObjectLength),
  }));
  assert.equal(exactBody.byteLength, BKFC_PAYMENT_RESPONSE_MAX_BYTES);
  const exact = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: [exactBody], status: 202,
    }));
  assert.equal(exact.disposition, "accepted");

  const retry = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret }, async () => streamingResponse({
      chunks: [new Uint8Array(BKFC_PAYMENT_RESPONSE_MAX_BYTES + 1)], status: 503,
      headers: { "retry-after": "120" },
    }), new Date("2026-08-25T10:00:00.000Z"));
  assert.equal(retry.disposition, "retry");
  assert.equal(retry.nextAttemptAt, "2026-08-25T10:02:00.000Z");

  const malformed = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response("not-json private response", { status: 202 }));
  assert.equal(malformed.disposition, "intervention");
  assert.equal(malformed.errorCode, "INVALID_RESPONSE");
  assert.equal(JSON.stringify(malformed).includes("private response"), false);

  const contractInvalid = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(JSON.stringify(["not", "an", "acknowledgment"]), { status: 202 }));
  assert.equal(contractInvalid.disposition, "intervention");
  assert.equal(contractInvalid.errorCode, "INVALID_RESPONSE");

  const failedBody = new ReadableStream<Uint8Array>({
    pull(controller) { controller.error(new Error("private response read failure")); },
  }, { highWaterMark: 0 });
  const readFailure = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(failedBody, { status: 202 }));
  assert.equal(readFailure.disposition, "intervention");
  assert.equal(readFailure.errorCode, "INVALID_RESPONSE");
  assert.equal(JSON.stringify(readFailure).includes("private response"), false);

  const empty = await deliverPaymentCommand(command(),
    { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(null, { status: 202 }));
  assert.equal(empty.disposition, "accepted");
  assert.equal(empty.outcome, null);
});

test("cancellation URL, tombstone race and already-paid outcomes are classified terminally", async () => {
  const cancellation = command("payment_cancellation");
  assert.equal(paymentCommandUrl("https://bkfc.example.test", cancellation),
    `https://bkfc.example.test/api/v1/integrations/eu/affiliate-applications/${applicationId}/payment-requests/${paymentRequestId}/cancellations`);
  const alreadyPaid = await deliverPaymentCommand(cancellation, { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(JSON.stringify({ code: "PAYMENT_ALREADY_COMPLETED", data: { outcome: "already_paid" } }), { status: 409 }));
  assert.equal(alreadyPaid.disposition, "accepted");
  assert.equal(alreadyPaid.outcome, "already_paid");
  const tombstoned = await deliverPaymentCommand(command(), { baseUrl: "https://bkfc.example.test", bearerSecret: outgoingSecret },
    async () => new Response(JSON.stringify({ code: "PAYMENT_REQUEST_CANCELLED" }), { status: 409 }));
  assert.equal(tombstoned.disposition, "accepted");
  assert.equal(tombstoned.outcome, "cancelled");
});

test("migration contains the frozen transactional, security and activation invariants", async () => {
  const sql = await readFile("supabase/migrations/20260825000000_bkfc_eu_affiliate_integration_v1.sql", "utf8");
  assert.match(sql, /where review_stage = 'submitted '/);
  assert.match(sql, /payment_status text not null default 'not_requested'/);
  assert.match(sql, /'payment_initiation', 'payment_cancellation'/);
  assert.match(sql, /'cancellation_queued'[\s\S]*'cancellation_intervention_required'/);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /delivery_status = 'suppressed'/);
  assert.match(sql, /command_type = 'payment_cancellation'/);
  assert.match(sql, /payment_request_id[\s\S]*references public\.affiliate_application_payment_command_outbox\(command_id\)/);
  assert.match(sql, /Payment status events are append-only/);
  assert.match(sql, /ACTIVATION_REQUIRES_APPROVED_AND_PAID/);
  assert.match(sql, /record_bkfc_payment_status_event_v1/);
  assert.match(sql, /security definer\s+set search_path = pg_catalog/gi);
  assert.match(sql, /revoke all on table public\.affiliate_application_payment_coordination from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.admin_transition_affiliate_application[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /stripe_(?:payment|checkout|session|intent)|checkout_url|checkoutUrl/i);
});

test("database transition logic makes repeated approval a no-op, suppresses safe initiation and otherwise cancels", async () => {
  const sql = await readFile("supabase/migrations/20260825000000_bkfc_eu_affiliate_integration_v1.sql", "utf8");
  const start = sql.indexOf("create or replace function public.admin_transition_affiliate_application");
  const end = sql.indexOf("create or replace function public.admin_create_affiliate_payment_request", start);
  const transition = sql.slice(start, end);
  const noOp = transition.indexOf("return query select false");
  const commandInsert = transition.indexOf("insert into public.affiliate_application_payment_command_outbox");
  assert.ok(noOp > 0 && commandInsert > noOp);
  assert.match(transition, /delivery_status in \('queued', 'retry_wait'\)[\s\S]*claim_token is null[\s\S]*delivery_status = 'suppressed'/);
  assert.match(transition, /'payment_cancellation'[\s\S]*'approval_reversal'/);
  assert.match(transition, /payment_status in \('paid', 'refunded'\) then payment_status/);
  assert.match(transition, /ACTIVATION_REQUIRES_APPROVED_AND_PAID/);
  assert.match(transition, /affiliate_application_audit_events/);
  assert.match(transition, /affiliate_application_notification_outbox/);
});

test("callback database function applies payment truth without mutating review state", async () => {
  const sql = await readFile("supabase/migrations/20260825000000_bkfc_eu_affiliate_integration_v1.sql", "utf8");
  const start = sql.indexOf("create or replace function public.record_bkfc_payment_status_event_v1");
  const end = sql.indexOf("alter table public.affiliate_application_payment_coordination enable", start);
  const callback = sql.slice(start, end);
  assert.match(callback, /insert into public\.affiliate_application_payment_status_events/);
  assert.match(callback, /payment_status = v_result/);
  assert.match(callback, /v_previous = 'refunded'[\s\S]*transition_not_permitted/);
  assert.match(callback, /p_event_type = 'payment_paid'[\s\S]*v_result := 'paid'/);
  assert.doesNotMatch(callback, /update public\.affiliate_applications/);
  assert.doesNotMatch(callback, /set review_stage|set status/);
});

test("submission responses expose no checkout redirect and approval communication assigns payment email to BKFC", async () => {
  const route = await readFile("app/api/v1/integrations/bkfc/affiliate-applications/route.ts", "utf8");
  const communication = await readFile("lib/application/applicant-communication.ts", "utf8");
  assert.doesNotMatch(route, /checkoutUrl|["']Location["']\s*:/);
  assert.match(route, /upsert: false/);
  assert.match(route, /storage\.from\(STORAGE_BUCKET\)\.remove/);
  assert.ok(route.indexOf("await parseBkfcSubmissionIngress") < route.indexOf("await validateBkfcSubmission"));
  assert.equal(route.includes("request.formData()"), false);
  assert.match(communication, /Official payment instructions will be sent separately by BKFC/);
  assert.doesNotMatch(communication, /stripe/i);
});
