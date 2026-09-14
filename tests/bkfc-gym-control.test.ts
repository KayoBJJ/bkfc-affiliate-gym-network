import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { deliverGymControl, LISTING_FIELDS, parseGymState, validateGymControlInput, logoContentType, type GymControlCommand } from "../lib/integrations/bkfc/gym-control.ts";
import { validatePaymentStatusEvent } from "../lib/integrations/bkfc/payment-status.ts";
import { resolveBkfcIntegrationConfig } from "../lib/config/policy.ts";
const application = randomUUID();
const config = { baseUrl: "https://api-dev.bkfc.sourcesync.io", bearerSecret: "fixture-secret" };
const state = () => ({ status: "paid", version: "3", euApplicationId: application, paymentRequestId: randomUUID(),
  subscription: { status: "active", currentPeriodEnd: "2026-10-13T04:38:27.000Z", cancelAtPeriodEnd: false },
  listing: { ...Object.fromEntries([...LISTING_FIELDS,"logoUrl"].map(k => [k,"fixture"])), displayOnSite: false },
  euDelivery: { acknowledged: true, attempts: 0, failedAt: null, lastError: null } });
function command(kind: GymControlCommand["command_type"], payload = {}): GymControlCommand {
  return { command_id: randomUUID(), application_id: application, bkfc_application_id: randomUUID(), command_type: kind,
    payload, expected_version: ["edit","logo"].includes(kind) ? "3" : null, attempt_count: 1, total_attempt_count: 1, claim_token: randomUUID() };
}
function response(code: string, data: unknown = {}, status = 200, success = true) {
  return Response.json({ success, code, requestId: randomUUID(), retryable: false, data }, { status });
}
test("v1.1 callbacks accept each named event without losing lifetime correlation", () => {
  for (const eventType of ["renewal_paid","renewal_past_due","subscription_cancelled"]) {
    const value = { contractVersion: 1, eventId: randomUUID(), paymentRequestId: randomUUID(), bkfcApplicationId: randomUUID(), euApplicationId: application, eventType, occurredAt: "2026-09-01T00:00:00Z", reasonCode: null };
    const parsed = validatePaymentStatusEvent(value, application);
    assert.equal(parsed.paymentRequestId, value.paymentRequestId);
    assert.equal(parsed.eventType, eventType);
    assert.equal(parsed.payloadHash.length, 64);
  }
});
test("gym controls are independently disabled by default", () => {
  const result = resolveBkfcIntegrationConfig({});
  assert.equal(result.gymControlDeliveryEnabled, false);
  assert.equal(result.paymentCallbackEnabled, false);
  assert.throws(() => resolveBkfcIntegrationConfig({ BKFC_GYM_CONTROL_DELIVERY_ENABLED: "true" }));
});
test("listing validation rejects missing versions, hidden fields and empty required values", () => {
  assert.throws(() => validateGymControlInput("edit", { gymName: "Gym" }, null));
  assert.throws(() => validateGymControlInput("edit", { paid: true }, "3"));
  assert.throws(() => validateGymControlInput("edit", { gymName: "" }, "3"));
  assert.doesNotThrow(() => validateGymControlInput("edit", { website: "" }, "3"));
  assert.throws(() => validateGymControlInput("visibility", { visible: "true", reasonCode: null }, null));
  assert.throws(() => validateGymControlInput("cancel_subscription", { cancellationId: randomUUID(), mode: "grace_period", reasonCode: "eu_requested" }, null));
});
test("all C1-C7 methods, paths, authentication and stable identities follow the contract", async () => {
  const logo = Buffer.from([137,80,78,71,13,10,26,10]);
  const rows = [
    [command("read"),"GET","","GYM_STATE",200],
    [command("edit",{ gymName: "Updated" }),"PATCH","","GYM_UPDATED",200],
    [command("logo",{ base64: logo.toString("base64"), contentType: "image/png" }),"PUT","/logo","GYM_LOGO_UPDATED",200],
    [command("visibility",{ visible: false, reasonCode: null }),"PUT","/visibility","GYM_VISIBILITY_UPDATED",200],
    [command("cancel_subscription",{ cancellationId: randomUUID(), mode: "at_period_end", reasonCode: "eu_requested" }),"POST","/subscription/cancellations","SUBSCRIPTION_CANCELLATION_ACCEPTED",202],
    [command("delist",{ reasonCode: "eu_requested" }),"DELETE","","GYM_DELISTED",200],
    [command("retry_deliveries"),"POST","/deliveries/retries","DELIVERY_RETRY_SCHEDULED",202],
  ] as const;
  for (const [c,method,path,code,status] of rows) {
    let called = false;
    const result = await deliverGymControl(c, config, async (url, init) => {
      called = true; assert.equal(String(url),`${config.baseUrl}/api/v1/integrations/eu/gyms/${c.bkfc_application_id}${path}`);
      assert.equal(init?.method,method); assert.equal(init?.redirect,"manual");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"),"Bearer fixture-secret");
      assert.equal(headers.get("idempotency-key"),c.command_id);
      assert.equal(headers.get("if-match"),c.expected_version);
      if (c.command_type === "logo") {
        assert.ok(init?.body instanceof FormData); assert.equal(headers.get("content-type"),null);
        assert.deepEqual(Buffer.from(await (init.body.get("logoUpload") as File).arrayBuffer()),logo);
      }
      const data = ["read","edit","logo"].includes(c.command_type) ? state() : c.command_type === "cancel_subscription" ? { outcome: c.payload.mode } : c.command_type === "delist" ? { outcome: "delisted" } : c.command_type === "retry_deliveries" ? { outcome: "scheduled", events: 0 } : {};
      return response(code,data,status);
    });
    assert.equal(called,true); assert.equal(result.disposition,"accepted");
  }
});
test("timeouts replay identical command keys/body/version, while attempt request IDs change", async () => {
  const c = command("edit",{ gymName: "Gym" }); const requests: RequestInit[] = [];
  const lost = await deliverGymControl(c,config,async (_url,init) => { requests.push(init!); throw new Error("timeout"); });
  assert.equal(lost.disposition,"retry");
  const replay = await deliverGymControl({...c,attempt_count:2,total_attempt_count:2},config,async (_url,init) => {requests.push(init!);return response("GYM_UPDATED",state());});
  assert.equal(replay.disposition,"accepted"); assert.equal(requests[0].body,requests[1].body);
  for (const h of ["idempotency-key","if-match"]) assert.equal(new Headers(requests[0].headers).get(h),new Headers(requests[1].headers).get(h));
  assert.notEqual(new Headers(requests[0].headers).get("x-request-id"),new Headers(requests[1].headers).get("x-request-id"));
});
test("stale edits require review, and rejections after an uncertain attempt do not erase uncertainty", async () => {
  const c=command("edit",{ city:"Sofia" });
  const fetcher=async()=>response("STALE_LISTING_VERSION",{},409,false);
  const stale=await deliverGymControl(c,config,fetcher); assert.equal(stale.disposition,"failed"); assert.equal(stale.code,"STALE_LISTING_VERSION");
  const uncertain=await deliverGymControl({...c,total_attempt_count:2},config,fetcher); assert.equal(uncertain.disposition,"uncertain");
});
test("redirects, malformed success, oversized bodies and correlation mismatches never confirm publication", async () => {
  const c=command("read");
  for (const fetcher of [
    async()=>new Response(null,{status:302,headers:{location:"https://example.test"}}),
    async()=>new Response("not JSON",{status:200}),
    async()=>new Response("x".repeat(32769),{status:200}),
    async()=>response("GYM_STATE",{...state(),euApplicationId:randomUUID()}),
  ]) assert.notEqual((await deliverGymControl(c,config,fetcher)).disposition,"accepted");
  assert.equal(parseGymState({...state(),subscription:{...state().subscription,currentPeriodEnd:"bad date"}},application),null);
});
test("upstream backoff caps at six hours and exhausted commands remain uncertain", async () => {
  const now=new Date("2026-09-14T00:00:00Z"); const c=command("read");
  const fetcher=async()=>new Response(null,{status:503,headers:{"retry-after":"999999"}});
  assert.equal((await deliverGymControl(c,config,fetcher,now)).nextAttemptAt,"2026-09-14T06:00:00.000Z");
  assert.equal((await deliverGymControl({...c,attempt_count:6},config,fetcher,now)).disposition,"uncertain");
});
test("logo validation checks bytes and size, not just declared MIME", () => {
  assert.equal(logoContentType(Buffer.from("GIF89a")),"image/gif");
  assert.throws(()=>logoContentType(Buffer.from("<script>")));
  assert.throws(()=>logoContentType(Buffer.alloc(10*1024*1024+1)));
  assert.throws(()=>validateGymControlInput("logo",{ base64:Buffer.from("GIF89a").toString("base64"),contentType:"image/png" },"3"));
});
test("cancellation and delivery recovery require the exact promised outcome", async () => {
  const c = command("cancel_subscription", { cancellationId: randomUUID(), mode: "at_period_end", reasonCode: "eu_requested" });
  assert.equal((await deliverGymControl(c,config,async()=>response("SUBSCRIPTION_CANCELLATION_ACCEPTED",{outcome:"immediately"},202))).disposition,"retry");
  const recovery = command("retry_deliveries");
  assert.equal((await deliverGymControl(recovery,config,async()=>response("DELIVERY_RETRY_SCHEDULED",{outcome:"scheduled",events:-1},202))).disposition,"retry");
});
