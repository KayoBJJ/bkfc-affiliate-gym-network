import assert from "node:assert/strict";
import test from "node:test";
import {
  attachApplicationFileAccess,
  FULL_APPLICATION_SELECT,
  LEGACY_APPLICATION_SELECT,
  normalizeAffiliateApplication,
  queryAffiliateApplicationsCompatibly,
} from "../lib/admin/applicationCompatibility.ts";

const legacyRow = {
  id: "legacy-application-id",
  created_at: "2026-07-20T10:00:00.000Z",
  gym_name: "Legacy Gym",
  city_country: "Sofia, Bulgaria",
  country: "Bulgaria",
  region: "Europe",
  contact_person: "Legacy Owner",
  email: "owner@example.com",
  phone: "+359 88 000 0000",
  website_instagram: "https://example.com/legacy-gym",
  disciplines_offered: "Boxing",
  logo_url: "https://legacy-cdn.example/logo.png",
  gym_photo_urls: ["https://legacy-cdn.example/gym-1.jpg"],
  fighter_list_url: "https://legacy-cdn.example/fighters.pdf",
  promo_video_link: null,
  review_consent: true,
  follow_up_consent: false,
  bkfc_app_access_interest: false,
  status: "new",
  review_stage: "submitted",
  internal_notes: null,
};

test("full Batch 1A admin query succeeds without a legacy retry", async () => {
  const selections: string[] = [];
  const result = await queryAffiliateApplicationsCompatibly(async (selection) => {
    selections.push(selection);
    return {
      data: [{ ...legacyRow, application_reference: "BKFC-GYM-ABC123", logo_path: "id/logo/a.png" }],
      error: null,
    };
  });

  assert.equal(result.schema, "full");
  assert.equal(result.error, null);
  assert.deepEqual(selections, [FULL_APPLICATION_SELECT]);
});

test("missing-column code 42703 triggers exactly one legacy query", async () => {
  const selections: string[] = [];
  const result = await queryAffiliateApplicationsCompatibly(async (selection) => {
    selections.push(selection);
    if (selection === FULL_APPLICATION_SELECT) {
      return { data: null, error: { code: "42703", message: "redacted database error" } };
    }
    return { data: [legacyRow], error: null };
  });

  assert.equal(result.schema, "legacy");
  assert.equal(result.error, null);
  assert.deepEqual(selections, [FULL_APPLICATION_SELECT, LEGACY_APPLICATION_SELECT]);
  assert.doesNotMatch(LEGACY_APPLICATION_SELECT, /application_reference|logo_path|gym_photo_paths|fighter_list_path/);
});

test("legacy rows normalize into the current admin application shape", () => {
  const normalized = normalizeAffiliateApplication(legacyRow, "legacy");
  assert.equal(normalized.application_reference, null);
  assert.equal(normalized.logo_path, null);
  assert.equal(normalized.gym_photo_paths, null);
  assert.equal(normalized.fighter_list_path, null);
  assert.equal(normalized.logo_url, legacyRow.logo_url);
  assert.deepEqual(normalized.gym_photo_urls, legacyRow.gym_photo_urls);
  assert.equal(normalized.fighter_list_url, legacyRow.fighter_list_url);
});

test("non-42703 errors are returned without being swallowed or retried", async () => {
  let calls = 0;
  const error = { code: "42501", message: "redacted permission error" };
  const result = await queryAffiliateApplicationsCompatibly(async () => {
    calls += 1;
    return { data: null, error };
  });

  assert.equal(calls, 1);
  assert.equal(result.schema, "full");
  assert.equal(result.error, error);
});

test("legacy detail records retain direct URL access without path columns", async () => {
  const normalized = normalizeAffiliateApplication(legacyRow, "legacy");
  const signedPaths: Array<string | null> = [];
  const detail = await attachApplicationFileAccess(
    normalized,
    async (path) => {
      signedPaths.push(path);
      return null;
    },
    () => null,
  );

  assert.equal(detail.logo_access_url, legacyRow.logo_url);
  assert.deepEqual(detail.gym_photo_access_urls, legacyRow.gym_photo_urls);
  assert.equal(detail.fighter_list_access_url, legacyRow.fighter_list_url);
  assert.deepEqual(signedPaths, [null, null, null]);
});

test("a failed legacy retry terminates after two total attempts", async () => {
  let calls = 0;
  const result = await queryAffiliateApplicationsCompatibly(async () => {
    calls += 1;
    return { data: null, error: { code: "42703", message: "redacted missing-column error" } };
  });

  assert.equal(calls, 2);
  assert.equal(result.schema, "legacy");
  assert.equal(result.error?.code, "42703");
});
