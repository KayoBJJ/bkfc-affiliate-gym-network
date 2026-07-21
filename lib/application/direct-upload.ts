import { createHash, randomUUID } from "node:crypto";
import { FILE_RULES, MAX_REQUEST_BYTES, ApplicationError } from "./policy.ts";
import type { IssuedUpload, UploadDescriptor, UploadField } from "./direct-upload-contract.ts";

const FIELDS: UploadField[] = ["logoUpload", "gymPhotos", "fighterListUpload"];
const PATH_KIND: Record<UploadField, string> = {
  logoUpload: "logo",
  gymPhotos: "gym-photos",
  fighterListUpload: "fighter-list",
};

export const UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000;

function extensionOf(name: string) {
  return name.toLocaleLowerCase("en-US").match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function canonicalContentType(extension: string) {
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  } as Record<string, string>)[extension];
}

function isDescriptor(value: unknown): value is UploadDescriptor {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return FIELDS.includes(item.field as UploadField) && typeof item.name === "string" &&
    Number.isSafeInteger(item.size) && Number(item.size) > 0 && typeof item.type === "string";
}

export function issueUploadManifest(applicationId: string, input: unknown): IssuedUpload[] {
  if (!Array.isArray(input) || !input.every(isDescriptor)) {
    throw new ApplicationError("VALIDATION_FAILED", 400, "uploadManifest");
  }
  const counts = new Map<UploadField, number>();
  let total = 0;
  const manifest = input.map((descriptor) => {
    const rule = FILE_RULES[descriptor.field];
    const extension = extensionOf(descriptor.name);
    if (!(rule.extensions as readonly string[]).includes(extension)) {
      throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, descriptor.field);
    }
    if (descriptor.size > rule.maxBytes) {
      throw new ApplicationError("FILE_TOO_LARGE", 400, descriptor.field);
    }
    const suppliedType = descriptor.type.toLocaleLowerCase("en-US");
    if (suppliedType && suppliedType !== "application/octet-stream" &&
      !(rule.mimeTypes as readonly string[]).includes(suppliedType)) {
      throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, descriptor.field);
    }
    counts.set(descriptor.field, (counts.get(descriptor.field) ?? 0) + 1);
    total += descriptor.size;
    return {
      ...descriptor,
      name: descriptor.name.slice(0, 255),
      type: suppliedType,
      path: `${applicationId}/${PATH_KIND[descriptor.field]}/${randomUUID()}.${extension}`,
      contentType: canonicalContentType(extension),
    };
  });
  if (counts.get("logoUpload") !== 1) throw new ApplicationError("REQUIRED_FIELD_MISSING", 400, "logoUpload");
  const photos = counts.get("gymPhotos") ?? 0;
  if (photos < 1) throw new ApplicationError("REQUIRED_FIELD_MISSING", 400, "gymPhotos");
  if (photos > FILE_RULES.gymPhotos.maxFiles) throw new ApplicationError("TOO_MANY_FILES", 400, "gymPhotos");
  if ((counts.get("fighterListUpload") ?? 0) > 1) throw new ApplicationError("TOO_MANY_FILES", 400, "fighterListUpload");
  if (total > MAX_REQUEST_BYTES) throw new ApplicationError("REQUEST_TOO_LARGE", 413);
  return manifest;
}

export function uploadSessionRequestHash(formPayload: Record<string, string>, manifest: IssuedUpload[]) {
  const sortedForm = Object.fromEntries(Object.entries(formPayload).sort(([left], [right]) => left.localeCompare(right)));
  const stableManifest = manifest.map(({ field, name, size, type, contentType }) => ({ field, name, size, type, contentType }));
  return createHash("sha256").update(JSON.stringify({ form: sortedForm, files: stableManifest })).digest("hex");
}

export function formPayloadFrom(formData: FormData) {
  const payload: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    payload[key] = value;
  }
  return payload;
}

export function formDataFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApplicationError("VALIDATION_FAILED", 400);
  }
  const formData = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") throw new ApplicationError("VALIDATION_FAILED", 400);
    formData.set(key, value);
  }
  return formData;
}

export function directStorageEndpoint(supabaseUrl: string) {
  const url = new URL(supabaseUrl);
  if (!url.hostname.endsWith(".supabase.co")) {
    return `${url.origin}/storage/v1/upload/resumable`;
  }
  const projectRef = url.hostname.split(".")[0];
  if (!projectRef) throw new Error("invalid_supabase_url");
  return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
}
