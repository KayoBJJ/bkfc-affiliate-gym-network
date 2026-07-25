import { randomUUID } from "node:crypto";
import { FILE_RULES } from "./policy.ts";

const RULE = FILE_RULES.informationResponseAttachment;

export type InformationAttachmentDescriptor = {
  name: string;
  size: number;
  type: string;
};

function extensionOf(name: string) {
  return name.toLocaleLowerCase("en-US").match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

export function canonicalInformationAttachmentType(extension: string) {
  return ({
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  } as Record<string, string>)[extension] ?? "";
}

export function validateInformationAttachmentDescriptor(
  value: unknown,
): InformationAttachmentDescriptor & { extension: string; contentType: string } {
  if (!value || typeof value !== "object") {
    throw new Error("Select a supported file.");
  }
  const descriptor = value as Record<string, unknown>;
  if (
    typeof descriptor.name !== "string" ||
    !descriptor.name.trim() ||
    descriptor.name.length > 255 ||
    !Number.isSafeInteger(descriptor.size) ||
    Number(descriptor.size) <= 0 ||
    typeof descriptor.type !== "string"
  ) {
    throw new Error("Select a valid file.");
  }
  if (Number(descriptor.size) > RULE.maxBytes) {
    throw new Error("Files must be 10 MB or smaller.");
  }
  const extension = extensionOf(descriptor.name);
  const suppliedType = descriptor.type.toLocaleLowerCase("en-US");
  const contentType = canonicalInformationAttachmentType(extension);
  if (
    !(RULE.extensions as readonly string[]).includes(extension) ||
    !contentType ||
    (suppliedType &&
      suppliedType !== "application/octet-stream" &&
      !(RULE.mimeTypes as readonly string[]).includes(suppliedType))
  ) {
    throw new Error("Use PDF, DOCX, XLSX, PNG, JPG, or WebP files.");
  }
  return {
    name: descriptor.name.trim(),
    size: Number(descriptor.size),
    type: suppliedType,
    extension,
    contentType,
  };
}

export function informationAttachmentStoragePath(
  applicationId: string,
  requestId: string,
  extension: string,
) {
  return `${applicationId}/information-responses/${requestId}/${randomUUID()}.${extension}`;
}
