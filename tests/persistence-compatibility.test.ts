import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  attachApplicationFileAccess,
  storagePathFromLegacyValue,
} from "../lib/admin/applicationCompatibility.ts";
import { clientErrorPayload } from "../lib/application/diagnostics.ts";
import {
  buildLegacyInsertPayload,
  compensateFailedInsert,
  insertApplicationCompatibly,
  LEGACY_INSERT_COLUMNS,
  type PersistenceValues,
} from "../lib/application/persistence.ts";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";
const logoPath = `${applicationId}/logo/123e4567-e89b-42d3-a456-426614174001.png`;
const photoPath = `${applicationId}/gym-photos/123e4567-e89b-42d3-a456-426614174002.jpg`;

const values: PersistenceValues = {
  id: applicationId,
  applicationReference: "BKFC-GYM-123E4567E89B",
  idempotencyKey: "58b3b08f-582f-4a1a-a11b-30b738532a23",
  payloadHash: "a".repeat(64),
  normalizedGymName: "test gym",
  normalizedEmail: "applicant@example.com",
  gymName: "Test Gym",
  cityCountry: "Sofia, Bulgaria",
  country: "Bulgaria",
  region: "Europe",
  contactPerson: "Test Owner",
  email: "applicant@example.com",
  phone: "+359 88 000 0000",
  websiteInstagram: "https://example.com/gym",
  disciplinesOffered: "Boxing",
  logoPath,
  gymPhotoPaths: [photoPath],
  fighterListPath: null,
  promoVideoLink: "",
  reviewConsent: true,
  followUpConsent: false,
  bkfcAppAccessInterest: false,
};

test("full-schema insert succeeds without fallback", async () => {
  const attempts: Record<string, unknown>[] = [];
  const result = await insertApplicationCompatibly(values, async (payload) => {
    attempts.push(payload);
    return { error: null };
  });

  assert.equal(attempts.length, 1);
  assert.equal(result.compatibilityMode, "full_schema");
  assert.equal(result.storedReference, values.applicationReference);
});

test("42703 triggers one allowlisted legacy retry and creates exactly one row", async () => {
  const attempts: Record<string, unknown>[] = [];
  const insertedRows: Record<string, unknown>[] = [];
  const result = await insertApplicationCompatibly(values, async (payload) => {
    attempts.push(payload);
    if (attempts.length === 1) {
      return { error: { code: "42703", message: "redacted missing-column error" } };
    }
    insertedRows.push(payload);
    return { error: null };
  });

  assert.equal(attempts.length, 2);
  assert.equal(insertedRows.length, 1);
  assert.equal(result.compatibilityMode, "legacy_schema");
  assert.equal(result.storedReference, applicationId);
  assert.equal(result.storedRowId, applicationId);
  assert.notEqual(result.storedReference, values.applicationReference);
  assert.deepEqual(Object.keys(insertedRows[0]).sort(), [...LEGACY_INSERT_COLUMNS].sort());
});

test("non-42703 persistence errors never trigger fallback", async () => {
  let attempts = 0;
  const error = { code: "42501", message: "redacted permission error" };
  const result = await insertApplicationCompatibly(values, async () => {
    attempts += 1;
    return { error };
  });

  assert.equal(attempts, 1);
  assert.equal(result.compatibilityMode, "full_schema");
  assert.equal(result.error, error);
  assert.equal(result.storedReference, null);
});

test("legacy payload contains private paths but no Batch 1A columns or undefined values", () => {
  const payload = buildLegacyInsertPayload(values);
  assert.equal(payload.logo_url, logoPath);
  assert.deepEqual(payload.gym_photo_urls, [photoPath]);
  assert.equal(payload.fighter_list_url, null);
  for (const key of [
    "application_reference",
    "idempotency_key",
    "payload_hash",
    "normalized_gym_name",
    "normalized_email",
    "logo_path",
    "gym_photo_paths",
    "fighter_list_path",
  ]) {
    assert.equal(key in payload, false);
  }
  assert.equal(Object.values(payload).some((value) => typeof value === "undefined"), false);
});

test("legacy private paths remain server-signable and scoped to their stored row", async () => {
  const legacyApplication = {
    ...buildLegacyInsertPayload(values),
    application_reference: null,
    created_at: "2026-07-21T00:00:00.000Z",
    logo_path: null,
    gym_photo_paths: null,
    fighter_list_path: null,
    internal_notes: null,
  };
  const signedPaths: string[] = [];
  const result = await attachApplicationFileAccess(
    legacyApplication,
    async (path) => {
      if (!path) return null;
      signedPaths.push(path);
      return `https://signed.invalid/${signedPaths.length}`;
    },
    (value) => storagePathFromLegacyValue(
      value,
      applicationId,
      "https://project.supabase.test",
      "affiliate-applications",
    ),
  );

  assert.deepEqual(signedPaths, [logoPath, photoPath]);
  assert.equal(result.logo_access_url, "https://signed.invalid/1");
  assert.deepEqual(result.gym_photo_access_urls, ["https://signed.invalid/2"]);
  assert.equal(storagePathFromLegacyValue(
    `other-row/logo/123e4567-e89b-42d3-a456-426614174001.png`,
    applicationId,
    "https://project.supabase.test",
    "affiliate-applications",
  ), null);
});

test("failed inserts clean staged uploads while successful fallback does not", async () => {
  let failedCleanup = 0;
  const failed = await insertApplicationCompatibly(values, async () => ({
    error: { code: "42703", message: "redacted" },
  }));
  await compensateFailedInsert(failed, async () => { failedCleanup += 1; });
  assert.equal(failedCleanup, 1);

  let successfulCleanup = 0;
  let calls = 0;
  const succeeded = await insertApplicationCompatibly(values, async () => {
    calls += 1;
    return calls === 1
      ? { error: { code: "42703", message: "redacted" } }
      : { error: null };
  });
  await compensateFailedInsert(succeeded, async () => { successfulCleanup += 1; });
  assert.equal(successfulCleanup, 0);
});

test("persistence failures expose only a stable code and notifications follow persistence", async () => {
  const response = JSON.stringify(clientErrorPayload("PERSISTENCE_UNAVAILABLE"));
  assert.deepEqual(JSON.parse(response), {
    success: false,
    code: "PERSISTENCE_UNAVAILABLE",
  });
  for (const privateValue of [values.email, values.phone, "redacted missing-column error"]) {
    assert.equal(response.includes(privateValue), false);
  }

  const route = await readFile(new URL("../app/api/affiliate-registration/route.ts", import.meta.url), "utf8");
  assert.match(route, /stage: "persistence", code: "PERSISTENCE_UNAVAILABLE"/);
  assert.doesNotMatch(route, /stage: "persistence", code: "VALIDATION_FAILED"/);
  assert.ok(route.indexOf("insertApplicationCompatibly") < route.lastIndexOf("sendApplicationNotifications"));
  assert.ok(route.lastIndexOf("sendApplicationNotifications") < route.lastIndexOf("return success(storedReference)"));
});
