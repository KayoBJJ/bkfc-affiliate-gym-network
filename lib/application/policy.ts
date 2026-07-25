export const STORAGE_BUCKET = "affiliate-applications";
export const MAX_REQUEST_BYTES = 70 * 1024 * 1024;
export const IDEMPOTENCY_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TEXT_RULES = {
  gymName: { required: true, max: 160 },
  cityCountry: { required: true, max: 160 },
  contactPerson: { required: true, max: 160 },
  email: { required: true, max: 254 },
  phone: { required: true, max: 40 },
  websiteInstagram: { required: true, max: 500 },
  disciplinesOffered: { required: true, max: 2000 },
  promoVideoLink: { required: false, max: 1000 },
} as const;

export const FILE_RULES = {
  logoUpload: {
    maxFiles: 1,
    maxBytes: 5 * 1024 * 1024,
    extensions: ["png", "jpg", "jpeg", "webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  gymPhotos: {
    minFiles: 1,
    maxFiles: 6,
    maxBytes: 8 * 1024 * 1024,
    extensions: ["png", "jpg", "jpeg", "webp"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp"],
  },
  fighterListUpload: {
    maxFiles: 1,
    maxBytes: 10 * 1024 * 1024,
    extensions: ["pdf", "doc", "docx", "xls", "xlsx"],
    mimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  informationResponseAttachment: {
    maxFiles: 1,
    maxBytes: 10 * 1024 * 1024,
    extensions: ["png", "jpg", "jpeg", "webp", "pdf", "docx", "xlsx"],
    mimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
} as const;

export type ApiCode =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_ALREADY_RECEIVED"
  | "BOT_DETECTED"
  | "CAPTCHA_INVALID"
  | "CAPTCHA_REQUIRED"
  | "CAPTCHA_UNAVAILABLE"
  | "DUPLICATE_SUBMISSION"
  | "FIELD_TOO_LONG"
  | "FILE_TOO_LARGE"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_CONSENT"
  | "INVALID_EMAIL"
  | "INVALID_FILE_SIGNATURE"
  | "INVALID_PHONE"
  | "INVALID_URL"
  | "PERSISTENCE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "REQUEST_TOO_LARGE"
  | "REQUIRED_FIELD_MISSING"
  | "TOO_MANY_FILES"
  | "UNSUPPORTED_FILE_TYPE"
  | "UNEXPECTED_FIELD"
  | "VALIDATION_FAILED";

export class ApplicationError extends Error {
  readonly code: ApiCode;
  readonly status: number;
  readonly field?: string;

  constructor(
    code: ApiCode,
    status: number,
    field?: string,
  ) {
    super(code);
    this.name = "ApplicationError";
    this.code = code;
    this.status = status;
    this.field = field;
  }
}
