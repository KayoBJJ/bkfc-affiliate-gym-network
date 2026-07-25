import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  informationAttachmentStoragePath,
  validateInformationAttachmentDescriptor,
} from "../lib/application/information-attachment.ts";

const migrationPath =
  "supabase/migrations/20260725000000_batch_1a3_secure_file_responses.sql";

test("information attachments accept a narrow file allowlist and generated private paths", () => {
  const descriptor = validateInformationAttachmentDescriptor({
    name: "updated-logo.png",
    size: 1024,
    type: "image/png",
  });
  assert.equal(descriptor.extension, "png");
  assert.equal(descriptor.contentType, "image/png");

  const path = informationAttachmentStoragePath(
    "123e4567-e89b-42d3-a456-426614174000",
    "123e4567-e89b-42d3-a456-426614174001",
    "png",
  );
  assert.match(
    path,
    /^123e4567-e89b-42d3-a456-426614174000\/information-responses\/123e4567-e89b-42d3-a456-426614174001\/[0-9a-f-]{36}\.png$/,
  );
  assert.doesNotMatch(path, /updated-logo/i);
});

test("information attachments reject executable, macro, and oversized files", () => {
  assert.throws(
    () =>
      validateInformationAttachmentDescriptor({
        name: "payload.exe",
        size: 100,
        type: "application/octet-stream",
      }),
    /PDF, DOCX, XLSX, PNG, JPG, or WebP/,
  );
  assert.throws(
    () =>
      validateInformationAttachmentDescriptor({
        name: "macro.docm",
        size: 100,
        type: "application/vnd.ms-word.document.macroEnabled.12",
      }),
    /PDF, DOCX, XLSX, PNG, JPG, or WebP/,
  );
  assert.throws(
    () =>
      validateInformationAttachmentDescriptor({
        name: "large.pdf",
        size: 10 * 1024 * 1024 + 1,
        type: "application/pdf",
      }),
    /10 MB/,
  );
});

test("file-response storage, review, versioning, and functions remain private", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /create table public\.affiliate_application_information_attachments/i,
  );
  assert.match(migration, /unique \(request_id, version\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(
    migration,
    /revoke all on table public\.affiliate_application_information_attachments\s+from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /status in \(\s*'uploading',\s*'uploaded',\s*'accepted',\s*'replacement_requested',\s*'rejected'/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.create_affiliate_information_attachment_upload[\s\S]*to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.finalize_affiliate_information_attachment[\s\S]*to service_role/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.admin_review_affiliate_information_attachment[\s\S]*to service_role/i,
  );
});

test("the browser uploads directly and the server verifies the stored object", async () => {
  const [form, route] = await Promise.all([
    readFile("app/application-response/[token]/ResponseForm.tsx", "utf8"),
    readFile("app/api/application-response/attachment/route.ts", "utf8"),
  ]);
  assert.match(form, /\.uploadToSignedUrl\(/);
  assert.match(form, /action: "finalize"/);
  assert.doesNotMatch(form, /new FormData\(\)[\s\S]*append\([^,]+,\s*selectedFile/);
  assert.match(route, /\.download\(attachment\.storage_path\)/);
  assert.match(
    route,
    /validateFile\([\s\S]*"informationResponseAttachment"/,
  );
  assert.match(route, /\.remove\(\[attachment\.storage_path\]\)/);
});

test("replacement links stay visible and can be securely regenerated", async () => {
  const [review, recovery, migration] = await Promise.all([
    readFile("components/admin/InformationAttachmentReview.tsx", "utf8"),
    readFile("components/admin/InformationResponseLinkRecovery.tsx", "utf8"),
    readFile(
      "supabase/migrations/20260725010000_batch_1a3_replacement_link_recovery.sql",
      "utf8",
    ),
  ]);
  assert.match(
    review,
    /attachment\.status !== "uploaded"[\s\S]*state\.responsePath[\s\S]*Open one-time replacement link/,
  );
  assert.match(recovery, /Generate new replacement link/);
  assert.match(
    migration,
    /create or replace function public\.admin_reissue_affiliate_information_response_link/i,
  );
  assert.match(
    migration,
    /set token_hash = p_token_hash[\s\S]*expires_at = greatest/i,
  );
  assert.match(
    migration,
    /revoke all on function public\.admin_reissue_affiliate_information_response_link[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.admin_reissue_affiliate_information_response_link[\s\S]*to service_role/i,
  );
});
