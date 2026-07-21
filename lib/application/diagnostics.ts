import type { ApiCode } from "./policy.ts";

const SAFE_FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;
const FILE_CATEGORIES = new Set(["logoUpload", "gymPhotos", "fighterListUpload"]);

export function safeFieldIdentifier(field: string | undefined) {
  if (!field) return undefined;
  return SAFE_FIELD_PATTERN.test(field) ? field : "unknownField";
}

export function validationDiagnostic(field: string | undefined) {
  const safeField = safeFieldIdentifier(field);
  return {
    ...(safeField ? { field: safeField } : {}),
    ...(safeField && FILE_CATEGORIES.has(safeField) ? { fileCategory: safeField } : {}),
  };
}

export function clientErrorPayload(code: ApiCode, field?: string) {
  const safeField = safeFieldIdentifier(field);
  return {
    success: false as const,
    code,
    ...(safeField ? { field: safeField } : {}),
  };
}
