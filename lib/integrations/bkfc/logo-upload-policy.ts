export const GYM_LOGO_BUCKET = "bkfc-control-logos";
export const GYM_LOGO_MAX_BYTES = 10 * 1024 * 1024;
export const GYM_LOGO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] as const;
export type LogoUploadMetadata = { applicationId: string; commandId: string; version: string; contentType: string; size: number; sha256: string };
export function validateLogoUploadMetadata(value: LogoUploadMetadata) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(value.applicationId) || !uuid.test(value.commandId) || !/^[0-9]{1,20}$/.test(value.version) ||
    !GYM_LOGO_CONTENT_TYPES.includes(value.contentType as typeof GYM_LOGO_CONTENT_TYPES[number]) ||
    !Number.isInteger(value.size) || value.size < 1 || value.size > GYM_LOGO_MAX_BYTES || !/^[a-f0-9]{64}$/.test(value.sha256)) throw new Error("INVALID_LOGO_UPLOAD");
}
export function logoUploadMatches(bytes: number, digest: string, contentType: string, intent: { size_bytes: number; sha256: string; content_type: string }) {
  return bytes === intent.size_bytes && digest === intent.sha256 && contentType === intent.content_type;
}
