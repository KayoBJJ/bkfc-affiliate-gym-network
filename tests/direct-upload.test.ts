import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  directStorageEndpoint,
  formDataFromPayload,
  formPayloadFrom,
  issueUploadManifest,
  uploadSessionRequestHash,
} from "../lib/application/direct-upload.ts";
import { ApplicationError } from "../lib/application/policy.ts";

const applicationId = "123e4567-e89b-42d3-a456-426614174000";

function descriptors() {
  return [
    { field: "logoUpload", name: "../../private logo.PNG", size: 512, type: "image/png" },
    { field: "gymPhotos", name: "gym.jpg", size: 1024, type: "image/jpeg" },
    { field: "fighterListUpload", name: "fighters.pdf", size: 2048, type: "application/pdf" },
  ];
}

function expectCode(callback: () => unknown, code: string, field?: string) {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof ApplicationError);
    assert.equal(error.code, code);
    if (field) assert.equal(error.field, field);
    return true;
  });
}

test("upload manifests issue only generated application-scoped private paths", () => {
  const manifest = issueUploadManifest(applicationId, descriptors());
  assert.equal(manifest.length, 3);
  assert.match(manifest[0].path, new RegExp(`^${applicationId}/logo/[0-9a-f-]{36}\\.png$`));
  assert.match(manifest[1].path, new RegExp(`^${applicationId}/gym-photos/[0-9a-f-]{36}\\.jpg$`));
  assert.equal(manifest.some((item) => item.path.includes("private logo")), false);
  assert.equal(manifest.some((item) => item.path.includes("..")), false);
});

test("manifest policy rejects missing, excessive, oversized, and unsupported files", () => {
  expectCode(() => issueUploadManifest(applicationId, descriptors().slice(1)), "REQUIRED_FIELD_MISSING", "logoUpload");
  const tooMany = descriptors().slice(0, 1).concat(Array.from({ length: 7 }, (_, index) => ({
    field: "gymPhotos", name: `gym-${index}.jpg`, size: 10, type: "image/jpeg",
  })));
  expectCode(() => issueUploadManifest(applicationId, tooMany), "TOO_MANY_FILES", "gymPhotos");
  const oversized = descriptors();
  oversized[0] = { ...oversized[0], size: 5 * 1024 * 1024 + 1 };
  expectCode(() => issueUploadManifest(applicationId, oversized), "FILE_TOO_LARGE", "logoUpload");
  const unsupported = descriptors();
  unsupported[0] = { ...unsupported[0], name: "logo.svg", type: "image/svg+xml" };
  expectCode(() => issueUploadManifest(applicationId, unsupported), "UNSUPPORTED_FILE_TYPE", "logoUpload");
});

test("form payload round-trip preserves strings but never serializes files", () => {
  const form = new FormData();
  form.set("gymName", "Test Gym");
  form.set("logoUpload", new File(["secret"], "secret.png", { type: "image/png" }));
  const payload = formPayloadFrom(form);
  assert.deepEqual(payload, { gymName: "Test Gym" });
  assert.equal(formDataFromPayload(payload).get("gymName"), "Test Gym");
  expectCode(() => formDataFromPayload({ gymName: { unsafe: true } }), "VALIDATION_FAILED");
});

test("direct storage endpoint uses the project storage hostname", () => {
  assert.equal(
    directStorageEndpoint("https://project-ref.supabase.co"),
    "https://project-ref.storage.supabase.co/storage/v1/upload/resumable",
  );
  assert.equal(
    directStorageEndpoint("http://127.0.0.1:54321"),
    "http://127.0.0.1:54321/storage/v1/upload/resumable",
  );
});

test("upload session request hashes are stable and detect changed form or file metadata", () => {
  const manifest = issueUploadManifest(applicationId, descriptors());
  const first = uploadSessionRequestHash({ gymName: "Test", email: "a@example.com" }, manifest);
  const reordered = uploadSessionRequestHash({ email: "a@example.com", gymName: "Test" }, manifest);
  const changedForm = uploadSessionRequestHash({ gymName: "Changed", email: "a@example.com" }, manifest);
  const changedFile = uploadSessionRequestHash({ gymName: "Test", email: "a@example.com" }, [
    { ...manifest[0], size: manifest[0].size + 1 }, ...manifest.slice(1),
  ]);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, reordered);
  assert.notEqual(first, changedForm);
  assert.notEqual(first, changedFile);
});

test("migration authorizes only exact issued paths and adds no applicant read policy", async () => {
  const sql = await readFile("supabase/migrations/20260721000000_batch_1a2_resumable_upload_sessions.sql", "utf8");
  assert.match(sql, /session\.uploader_id = auth\.uid\(\)/);
  assert.match(sql, /item ->> 'path' = object_name/);
  assert.match(sql, /session\.expires_at > now\(\)/);
  assert.match(sql, /for insert\s+to authenticated/i);
  assert.doesNotMatch(sql, /for select\s+to authenticated/i);
});

test("the browser flow uploads directly with TUS and finalizes with small JSON", async () => {
  const form = await readFile("components/RegistrationForm.tsx", "utf8");
  const uploader = await readFile("lib/application/resumable-upload-client.ts", "utf8");
  assert.match(uploader, /new tus\.Upload/);
  assert.match(uploader, /chunkSize: 6 \* 1024 \* 1024/);
  assert.match(uploader, /resumeFromPreviousUpload/);
  assert.match(form, /affiliate-registration\/upload-session/);
  assert.match(form, /affiliate-registration\/finalize/);
  assert.match(form, /if \(issued\.uploaded\)/);
  assert.doesNotMatch(form, /fetch\("\/api\/affiliate-registration",\s*\{[\s\S]*body: formData/);
});
