import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";
import { buildInternalNotificationEmail } from "../lib/application/email-content.ts";
import {
  clientErrorPayload,
  validationDiagnostic,
} from "../lib/application/diagnostics.ts";
import {
  BOT_TRAP_FIELD,
  FORM_STARTED_AT_FIELD,
} from "../lib/application/bot-policy.ts";
import { ApplicationError } from "../lib/application/policy.ts";
import { removeRequestObjects, resolveIdempotency } from "../lib/application/integrity.ts";
import { runNonCriticalNotification } from "../lib/application/staged.ts";
import { validateApplicationForm } from "../lib/application/validation.ts";
import {
  ConfigurationError,
  resolveEmailRouting,
  resolvePrivilegedSupabaseConfig,
  resolveProxyTrustConfig,
  resolveRateLimitConfig,
} from "../lib/config/policy.ts";

const execFileAsync = promisify(execFile);
const TEST_EMAIL_ENV = {
  RESEND_API_KEY: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  APPLICANT_EMAIL_FROM: "Approved Sender <sender@bkfc.test>",
  APPLICANT_EMAIL_TEST_RECIPIENT: "controlled@bkfc.test",
  INTERNAL_NOTIFICATION_RECIPIENT: "internal@bkfc.test",
};

function imageFile(name = "logo.png", size = 16, type = "image/png") {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], name, { type });
}

function oleFile(name = "fighters.xls", size = 16, type = "application/vnd.ms-excel") {
  const bytes = new Uint8Array(size);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  return new File([bytes], name, { type });
}

function validForm() {
  const form = new FormData();
  form.set("gymName", " Example Gym ");
  form.set("cityCountry", "Sofia, Bulgaria");
  form.set("contactPerson", "Test Owner");
  form.set("email", "applicant@example.com");
  form.set("phone", "+359 88 123 4567");
  form.set("websiteInstagram", "https://example.com/gym");
  form.set("disciplinesOffered", "Boxing, MMA");
  form.set("promoVideoLink", "https://video.example.com/watch/1");
  form.set("reviewConsent", "on");
  form.set(BOT_TRAP_FIELD, "");
  form.set(FORM_STARTED_AT_FIELD, String(Date.now() - 5_000));
  form.set("idempotencyKey", "58b3b08f-582f-4a1a-a11b-30b738532a23");
  form.set("logoUpload", imageFile());
  form.append("gymPhotos", imageFile("gym.png"));
  return form;
}

async function expectCode(form: FormData, code: string) {
  await assert.rejects(() => validateApplicationForm(form), (error: unknown) => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    return true;
  });
}

async function getValidationError(form: FormData) {
  try {
    await validateApplicationForm(form);
    assert.fail("Expected validation to reject the form");
  } catch (error) {
    assert.ok(error instanceof ApplicationError);
    return error;
  }
}

test("a valid submission normalizes values and passes controlled policy", async () => {
  const result = await validateApplicationForm(validForm());
  assert.equal(result.gymName, "Example Gym");
  assert.equal(result.normalizedEmail, "applicant@example.com");
  assert.equal(result.gymPhotos.length, 1);
  assert.match(result.payloadHash, /^[a-f0-9]{64}$/);
});

test("invalid email and URL are rejected", async () => {
  const email = validForm();
  email.set("email", "not-an-email");
  await expectCode(email, "INVALID_EMAIL");
  const url = validForm();
  url.set("promoVideoLink", "javascript:alert(1)");
  await expectCode(url, "INVALID_URL");
});

test("validation errors identify missing text and invalid URL fields", async () => {
  const missing = validForm();
  missing.delete("gymName");
  const missingError = await getValidationError(missing);
  assert.equal(missingError.code, "REQUIRED_FIELD_MISSING");
  assert.equal(missingError.field, "gymName");

  const invalidUrl = validForm();
  invalidUrl.set("websiteInstagram", "not a valid URL");
  const urlError = await getValidationError(invalidUrl);
  assert.equal(urlError.code, "INVALID_URL");
  assert.equal(urlError.field, "websiteInstagram");
});

test("invalid logo and gym photo errors identify only their file category", async () => {
  const invalidLogo = validForm();
  invalidLogo.set("logoUpload", new File(["GIF89a"], "private-logo.gif", { type: "image/gif" }));
  const logoError = await getValidationError(invalidLogo);
  assert.equal(logoError.code, "UNSUPPORTED_FILE_TYPE");
  assert.equal(logoError.field, "logoUpload");

  const invalidPhoto = validForm();
  invalidPhoto.set("gymPhotos", new File(["GIF89a"], "private-photo.gif", { type: "image/gif" }));
  const photoError = await getValidationError(invalidPhoto);
  assert.equal(photoError.code, "UNSUPPORTED_FILE_TYPE");
  assert.equal(photoError.field, "gymPhotos");
});

test("file signature mismatches use a stable field-aware code", async () => {
  const mismatch = validForm();
  mismatch.set("logoUpload", new File(["not a png"], "private-logo.png", { type: "image/png" }));
  const error = await getValidationError(mismatch);
  assert.equal(error.code, "INVALID_FILE_SIGNATURE");
  assert.equal(error.field, "logoUpload");
});

test("unexpected and generic validation failures retain safe field identifiers", async () => {
  const unexpected = validForm();
  unexpected.set("unexpectedProbe", "applicant-private-value");
  const unexpectedError = await getValidationError(unexpected);
  assert.equal(unexpectedError.code, "UNEXPECTED_FIELD");
  assert.equal(unexpectedError.field, "unexpectedProbe");

  const unsafeUnexpected = validForm();
  unsafeUnexpected.set("applicant@example.com", "private value");
  const unsafeUnexpectedError = await getValidationError(unsafeUnexpected);
  assert.equal(unsafeUnexpectedError.code, "UNEXPECTED_FIELD");
  assert.equal(unsafeUnexpectedError.field, "unknownField");

  const generic = validForm();
  generic.append("gymName", "duplicate applicant value");
  const genericError = await getValidationError(generic);
  assert.equal(genericError.code, "VALIDATION_FAILED");
  assert.equal(genericError.field, "gymName");
});

test("validation response and log diagnostics exclude applicant values and filenames", async () => {
  const form = validForm();
  form.set("logoUpload", new File(["not a png"], "sensitive-applicant-filename.png", { type: "image/png" }));
  const error = await getValidationError(form);
  const response = JSON.stringify(clientErrorPayload(error.code, error.field));
  const log = JSON.stringify({ stage: "validation", code: error.code, ...validationDiagnostic(error.field) });

  assert.deepEqual(JSON.parse(response), {
    success: false,
    code: "INVALID_FILE_SIGNATURE",
    field: "logoUpload",
  });
  assert.deepEqual(JSON.parse(log), {
    stage: "validation",
    code: "INVALID_FILE_SIGNATURE",
    field: "logoUpload",
    fileCategory: "logoUpload",
  });
  for (const privateValue of ["applicant@example.com", "+359 88 123 4567", "sensitive-applicant-filename.png"]) {
    assert.equal(response.includes(privateValue), false);
    assert.equal(log.includes(privateValue), false);
  }
});

test("oversized, unsupported, and excessive image files are rejected", async () => {
  const oversized = validForm();
  oversized.set("logoUpload", imageFile("large.png", 5 * 1024 * 1024 + 1));
  await expectCode(oversized, "FILE_TOO_LARGE");
  const unsupported = validForm();
  unsupported.set("logoUpload", new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
  await expectCode(unsupported, "UNSUPPORTED_FILE_TYPE");
  const excessive = validForm();
  for (let index = 1; index < 7; index += 1) excessive.append("gymPhotos", imageFile(`gym-${index}.png`));
  await expectCode(excessive, "TOO_MANY_FILES");
});

test("oversized fighter lists are rejected", async () => {
  const fighter = validForm();
  fighter.set("fighterListUpload", oleFile("fighters.xls", 10 * 1024 * 1024 + 1));
  await expectCode(fighter, "FILE_TOO_LARGE");
});

test("empty, missing, and whitespace-only honeypot values pass", async () => {
  const empty = validForm();
  await validateApplicationForm(empty);

  const missing = validForm();
  missing.delete(BOT_TRAP_FIELD);
  await validateApplicationForm(missing);

  const whitespace = validForm();
  whitespace.set(BOT_TRAP_FIELD, "  \n\t  ");
  await validateApplicationForm(whitespace);
});

test("a meaningful honeypot value returns BOT_DETECTED", async () => {
  const bot = validForm();
  bot.set(BOT_TRAP_FIELD, "automated value");
  await expectCode(bot, "BOT_DETECTED");
});

test("rapid timing rejects only when the rendered trap field is also missing", async () => {
  const now = Date.now();
  const rapidRenderedForm = validForm();
  rapidRenderedForm.set(FORM_STARTED_AT_FIELD, String(now - 100));
  await validateApplicationForm(rapidRenderedForm);

  const rapidScriptedForm = validForm();
  rapidScriptedForm.delete(BOT_TRAP_FIELD);
  rapidScriptedForm.set(FORM_STARTED_AT_FIELD, String(now - 100));
  await expectCode(rapidScriptedForm, "BOT_DETECTED");
});

test("honeypot input resists autofill and stays outside interaction and layout", async () => {
  const form = await readFile(new URL("../components/RegistrationForm.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(form, /name=\{BOT_TRAP_FIELD\}/);
  assert.match(form, /type="text"[\s\S]*value=""[\s\S]*readOnly[\s\S]*tabIndex=\{-1\}[\s\S]*aria-hidden="true"[\s\S]*autoComplete="off"[\s\S]*data-lpignore="true"[\s\S]*data-1p-ignore="true"/);
  assert.doesNotMatch(form, /companyWebsite|Company website/);
  const honeypotCss = css.match(/\.form-honeypot\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(honeypotCss, /position:\s*absolute/);
  assert.match(honeypotCss, /pointer-events:\s*none/);
  assert.match(honeypotCss, /clip-path:\s*inset\(50%\)/);
  assert.doesNotMatch(honeypotCss, /display:\s*none/);
});

test("honeypot data cannot enter structured application logs", async () => {
  const validation = await readFile(new URL("../lib/application/validation.ts", import.meta.url), "utf8");
  const botPolicy = await readFile(new URL("../lib/application/bot-policy.ts", import.meta.url), "utf8");
  const logging = await readFile(new URL("../lib/application/logging.ts", import.meta.url), "utf8");
  assert.doesNotMatch(validation, /console\.|logApplicationEvent/);
  assert.doesNotMatch(botPolicy, /console\.|logApplicationEvent|JSON\.stringify/);
  assert.doesNotMatch(logging, /honeypot|BOT_TRAP_FIELD|q7m2_delta/);
});

test("controlled email routing never targets the applicant", () => {
  const routing = resolveEmailRouting("applicant@example.com", {
    ...TEST_EMAIL_ENV,
    APPLICANT_EMAIL_DELIVERY_ENABLED: "false",
  });
  assert.equal(routing.applicant.recipient, "controlled@bkfc.test");
  assert.notEqual(routing.applicant.recipient, "applicant@example.com");
  assert.equal(routing.internal.recipient, "internal@bkfc.test");
  assert.equal(routing.subjectPrefix, "[TEST MODE] ");
});

test("production email routing selects the applicant only with all approved settings", () => {
  const routing = resolveEmailRouting("applicant@example.com", {
    ...TEST_EMAIL_ENV,
    APPLICANT_EMAIL_DELIVERY_ENABLED: "true",
    APPLICANT_EMAIL_REPLY_TO: "reply@bkfc.test",
  });
  assert.equal(routing.applicant.enabled, true);
  assert.equal(routing.applicant.recipient, "applicant@example.com");
  assert.equal(routing.applicant.from, TEST_EMAIL_ENV.APPLICANT_EMAIL_FROM);
  assert.equal(routing.applicant.replyTo, "reply@bkfc.test");
  assert.equal(routing.subjectPrefix, "");
});

test("production applicant delivery fails closed without provider, sender, or reply-to", () => {
  for (const missing of ["RESEND_API_KEY", "APPLICANT_EMAIL_FROM", "APPLICANT_EMAIL_REPLY_TO"] as const) {
    const routing = resolveEmailRouting("applicant@example.com", {
      ...TEST_EMAIL_ENV,
      APPLICANT_EMAIL_DELIVERY_ENABLED: "true",
      APPLICANT_EMAIL_REPLY_TO: "reply@bkfc.test",
      [missing]: undefined,
    });
    assert.equal(routing.applicant.enabled, false);
    assert.equal(routing.applicant.skipCode, "CONFIG_EMAIL_INVALID");
  }
});

test("missing controlled recipients skip only their own notification capability", () => {
  const noTestRecipient = resolveEmailRouting("applicant@example.com", {
    ...TEST_EMAIL_ENV,
    APPLICANT_EMAIL_TEST_RECIPIENT: undefined,
    APPLICANT_EMAIL_DELIVERY_ENABLED: "false",
  });
  assert.equal(noTestRecipient.applicant.enabled, false);
  assert.equal(noTestRecipient.applicant.skipCode, "EMAIL_TEST_DELIVERY_SKIPPED");
  assert.equal(noTestRecipient.internal.enabled, true);
  assert.notEqual(noTestRecipient.applicant.recipient, "applicant@example.com");

  const noInternalRecipient = resolveEmailRouting("applicant@example.com", {
    ...TEST_EMAIL_ENV,
    INTERNAL_NOTIFICATION_RECIPIENT: undefined,
    APPLICANT_EMAIL_DELIVERY_ENABLED: "false",
  });
  assert.equal(noInternalRecipient.internal.enabled, false);
  assert.equal(noInternalRecipient.internal.skipCode, "INTERNAL_NOTIFICATION_SKIPPED");
  assert.equal(noInternalRecipient.applicant.enabled, true);
});

test("rate-limit secret is independent and fails closed when absent, weak, or placeholder", () => {
  for (const env of [
    { SUPABASE_SERVICE_ROLE_KEY: "service-role-value-that-must-not-be-reused" },
    { RATE_LIMIT_HASH_SECRET: "short" },
    { RATE_LIMIT_HASH_SECRET: "replace-with-default-secret-value-123456" },
  ]) {
    assert.throws(() => resolveRateLimitConfig(env), (error: unknown) =>
      error instanceof ConfigurationError && error.code === "CONFIG_RATE_LIMIT_INVALID");
  }
  assert.equal(resolveRateLimitConfig({ RATE_LIMIT_HASH_SECRET: "0123456789abcdef0123456789ABCDEF" }).secret.length, 32);
});

test("privileged Supabase configuration fails closed without a service-role key", () => {
  assert.throws(
    () => resolvePrivilegedSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.test" }),
    (error: unknown) => error instanceof ConfigurationError && error.code === "CONFIG_SUPABASE_INVALID",
  );
});

test("invalid proxy configuration resolves to non-trusting mode", () => {
  assert.deepEqual(resolveProxyTrustConfig({ TRUSTED_PROXY_PROVIDER: "arbitrary-forwarded-header" }), {
    provider: "none",
    valid: false,
  });
});

test("notification failure is non-critical after persistence", async () => {
  const result = await runNonCriticalNotification(async () => { throw new Error("provider detail"); });
  assert.equal(result, "failed");
});

test("database failure cleanup removes only objects tracked by the request", async () => {
  const removed: string[][] = [];
  const result = await removeRequestObjects(["app-id/logo/a.png", "app-id/gym-photos/b.png"], async (paths) => {
    removed.push(paths);
    return { error: null };
  });
  assert.equal(result, "succeeded");
  assert.deepEqual(removed, [["app-id/logo/a.png", "app-id/gym-photos/b.png"]]);
});

test("identical idempotency retries reuse a result and changed payloads conflict", () => {
  const prior = { applicationReference: "BKFC-GYM-ABC12345", payloadHash: "same" };
  assert.deepEqual(resolveIdempotency(prior, "same"), { outcome: "reuse", applicationReference: "BKFC-GYM-ABC12345" });
  assert.deepEqual(resolveIdempotency(prior, "changed"), { outcome: "conflict" });
  assert.deepEqual(resolveIdempotency(null, "new"), { outcome: "new" });
});

test("route and admin source enforce safe contracts", async () => {
  const route = await readFile(new URL("../app/api/affiliate-registration/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../lib/admin/supabase.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../components/RegistrationForm.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(route, /getPublicUrl|error\.message|stack/);
  assert.doesNotMatch(route, /RATE_LIMIT_HASH_SECRET\s*\|\||getSupabaseServiceRoleKey\(\)/);
  assert.match(route, /idempotency_key/);
  assert.match(route, /check_affiliate_application_rate_limit/);
  assert.match(route, /cleanup\(supabase, uploaded/);
  assert.ok(route.indexOf("await checkRateLimit") < route.indexOf("const logoPath = await upload"));
  assert.ok(route.indexOf("const logoPath = await upload") < route.indexOf('.from("affiliate_applications").insert'));
  assert.match(admin, /createSignedUrl\(path, 10 \* 60\)/);
  assert.match(admin, /storagePathFromLegacyValue/);
  assert.match(form, /applicationReference/);
  assert.doesNotMatch(form, /payload\.message/);
  for (const language of ["en", "es", "pt", "ru", "de", "it", "pl"]) {
    assert.match(form, new RegExp(`\\b${language}: \\{ logoHelp:`));
  }
});

test("local environment files are ignored and the committed example uses placeholders", async () => {
  const repository = new URL("..", import.meta.url).pathname;
  await execFileAsync("git", ["check-ignore", "-q", ".env.local"], { cwd: repository });
  await assert.rejects(() => execFileAsync("git", ["ls-files", "--error-unmatch", ".env.local"], { cwd: repository }));
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  assert.match(example, /APPLICANT_EMAIL_DELIVERY_ENABLED=false/);
  assert.match(example, /RATE_LIMIT_HASH_SECRET=replace-with-/);
  assert.doesNotMatch(example, /(?:re|sk)_[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(example, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/);
});

test("privileged configuration and provider modules preserve server-only boundaries", async () => {
  for (const relative of [
    "../lib/config/server.ts",
    "../lib/supabase/env.ts",
    "../lib/application/email.ts",
    "../lib/application/logging.ts",
    "../lib/application/rate-limit.ts",
    "../lib/admin/access.ts",
    "../lib/admin/supabase.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /import "server-only";/);
  }
  const route = await readFile(new URL("../app/api/affiliate-registration/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(route, /process\.env/);
});

test("internal notification restores approved fields and excludes attachment access details", () => {
  const html = buildInternalNotificationEmail({
    applicationReference: "BKFC-GYM-TEST123",
    gymName: "A & B Gym",
    cityCountry: "Sofia, Bulgaria",
    contactPerson: "Test Owner",
    email: "applicant@example.com",
    phone: "+359 88 000 0000",
    websiteInstagram: "https://example.com/gym",
    disciplinesOffered: "Boxing, MMA",
    promoVideoLink: "https://video.example.com/watch/1",
    bkfcAppAccessInterest: true,
    reviewConsent: true,
    followUpConsent: false,
    facilityPhotoCount: 3,
    fighterListSupplied: true,
  });
  for (const label of ["Application reference", "Phone", "Disciplines", "Promotional video", "Facility photos", "Fighter list supplied"]) {
    assert.match(html, new RegExp(label));
  }
  assert.match(html, /A &amp; B Gym/);
  assert.doesNotMatch(html, /signedUrl|logo_path|gym_photo_paths|fighter_list_path|\/storage\/v1\/object/);
});

test("logging and client error source omit sensitive raw fields", async () => {
  const logging = await readFile(new URL("../lib/application/logging.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/affiliate-registration/route.ts", import.meta.url), "utf8");
  assert.doesNotMatch(logging, /email\??:|phone\??:|filename|signedUrl|payload/);
  assert.doesNotMatch(route, /error\.message|error\.stack|JSON\.stringify\(application\)/);
  assert.match(route, /CONFIG_RATE_LIMIT_INVALID|ConfigurationError/);
});
