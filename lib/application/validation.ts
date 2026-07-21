import { createHash } from "node:crypto";
import {
  ApplicationError,
  FILE_RULES,
  IDEMPOTENCY_KEY_PATTERN,
  MAX_REQUEST_BYTES,
  TEXT_RULES,
} from "./policy.ts";
import {
  BOT_TRAP_FIELD,
  enforceBotSignals,
  FORM_STARTED_AT_FIELD,
} from "./bot-policy.ts";

const ALLOWED_FIELDS = new Set([
  ...Object.keys(TEXT_RULES),
  "logoUpload",
  "gymPhotos",
  "fighterListUpload",
  "reviewConsent",
  "followUpConsent",
  "bkfcAppAccessInterest",
  "idempotencyKey",
  BOT_TRAP_FIELD,
  FORM_STARTED_AT_FIELD,
]);

export type ValidatedFile = { file: File; extension: string };
export type ValidatedApplication = {
  gymName: string;
  cityCountry: string;
  contactPerson: string;
  email: string;
  phone: string;
  websiteInstagram: string;
  disciplinesOffered: string;
  promoVideoLink: string;
  reviewConsent: true;
  followUpConsent: boolean;
  bkfcAppAccessInterest: boolean;
  idempotencyKey: string;
  normalizedGymName: string;
  normalizedEmail: string;
  logo: ValidatedFile;
  gymPhotos: ValidatedFile[];
  fighterList: ValidatedFile | null;
  payloadHash: string;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeIdentity(value: string) {
  return normalizeWhitespace(value).normalize("NFKC").toLocaleLowerCase("en-US");
}

function requireString(formData: FormData, key: keyof typeof TEXT_RULES) {
  const values = formData.getAll(key);
  if (values.length !== 1) throw new ApplicationError("VALIDATION_FAILED", 400, key);
  const raw = values[0];
  if (typeof raw !== "string") {
    throw new ApplicationError("VALIDATION_FAILED", 400, key);
  }
  const value = normalizeWhitespace(raw);
  const rule = TEXT_RULES[key];
  if (rule.required && !value) {
    throw new ApplicationError("REQUIRED_FIELD_MISSING", 400, key);
  }
  if (value.length > rule.max) {
    throw new ApplicationError("FIELD_TOO_LONG", 400, key);
  }
  return value;
}

function parseConsent(formData: FormData, key: string, required = false) {
  const values = formData.getAll(key);
  if (values.length > 1 || values.some((value) => typeof value !== "string")) {
    throw new ApplicationError("INVALID_CONSENT", 400, key);
  }
  const value = values[0];
  if (typeof value === "undefined") {
    if (required) throw new ApplicationError("INVALID_CONSENT", 400, key);
    return false;
  }
  if (value !== "on") throw new ApplicationError("INVALID_CONSENT", 400, key);
  return true;
}

function normalizeUrl(value: string, field: string, allowInstagramHandle = false) {
  if (!value) return "";
  if (allowInstagramHandle && /^@[A-Za-z0-9._]{1,30}$/.test(value)) {
    return `https://www.instagram.com/${value.slice(1)}/`;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString();
  } catch {
    throw new ApplicationError("INVALID_URL", 400, field);
  }
}

function extensionOf(name: string) {
  const match = name.toLocaleLowerCase("en-US").match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function signatureFamily(bytes: Uint8Array) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "pdf";
  if ([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, index) => bytes[index] === byte)) return "ole";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && [0x03, 0x05, 0x07].includes(bytes[2])) return "zip";
  return "unknown";
}

function extensionFamily(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "doc" || extension === "xls") return "ole";
  if (extension === "docx" || extension === "xlsx") return "zip";
  return extension;
}

async function validateFile(file: File, field: keyof typeof FILE_RULES): Promise<ValidatedFile> {
  const rule = FILE_RULES[field];
  if (file.size > rule.maxBytes) throw new ApplicationError("FILE_TOO_LARGE", 400, field);
  const extension = extensionOf(file.name);
  if (!(rule.extensions as readonly string[]).includes(extension)) {
    throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, field);
  }
  const suppliedMime = file.type.toLocaleLowerCase("en-US");
  if (suppliedMime && suppliedMime !== "application/octet-stream" && !(rule.mimeTypes as readonly string[]).includes(suppliedMime)) {
    throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, field);
  }
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (signatureFamily(bytes) !== extensionFamily(extension)) {
    throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, field);
  }
  const exactMime: Record<string, string[]> = {
    png: ["image/png"], jpg: ["image/jpeg"], jpeg: ["image/jpeg"], webp: ["image/webp"],
    pdf: ["application/pdf"], doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls: ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  };
  if (suppliedMime && suppliedMime !== "application/octet-stream" && !exactMime[extension]?.includes(suppliedMime)) {
    throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, field);
  }
  if (extension === "docx" || extension === "xlsx") {
    const archive = Buffer.from(await file.arrayBuffer());
    const marker = extension === "docx" ? Buffer.from("word/") : Buffer.from("xl/");
    if (!archive.includes(marker)) throw new ApplicationError("UNSUPPORTED_FILE_TYPE", 400, field);
  }
  return { file, extension };
}

function filesFor(formData: FormData, field: keyof typeof FILE_RULES) {
  const values = formData.getAll(field);
  if (values.some((value) => !(value instanceof File))) {
    throw new ApplicationError("VALIDATION_FAILED", 400, field);
  }
  return (values as File[]).filter((file) => file.size > 0);
}

async function hashPayload(parts: Array<string | File>) {
  const hash = createHash("sha256");
  for (const part of parts) {
    if (typeof part === "string") hash.update(part);
    else hash.update(new Uint8Array(await part.arrayBuffer()));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function validateApplicationForm(formData: FormData): Promise<ValidatedApplication> {
  for (const key of formData.keys()) {
    if (!ALLOWED_FIELDS.has(key)) throw new ApplicationError("VALIDATION_FAILED", 400, key);
  }
  enforceBotSignals(formData);
  const idempotencyKey = formData.get("idempotencyKey");
  if (typeof idempotencyKey !== "string" || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new ApplicationError("VALIDATION_FAILED", 400, "idempotencyKey");
  }

  const gymName = requireString(formData, "gymName");
  const cityCountry = requireString(formData, "cityCountry");
  const contactPerson = requireString(formData, "contactPerson");
  const email = requireString(formData, "email").toLocaleLowerCase("en-US");
  const phone = requireString(formData, "phone");
  const websiteInstagram = normalizeUrl(requireString(formData, "websiteInstagram"), "websiteInstagram", true);
  const disciplinesOffered = requireString(formData, "disciplinesOffered");
  const promoVideoLink = normalizeUrl(requireString(formData, "promoVideoLink"), "promoVideoLink");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new ApplicationError("INVALID_EMAIL", 400, "email");
  if (!/^\+?[0-9][0-9\s()./-]{6,38}$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 7) {
    throw new ApplicationError("INVALID_PHONE", 400, "phone");
  }
  const disciplines = disciplinesOffered.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean);
  if (disciplines.length > 20) throw new ApplicationError("FIELD_TOO_LONG", 400, "disciplinesOffered");

  const logos = filesFor(formData, "logoUpload");
  const photos = filesFor(formData, "gymPhotos");
  const fighterLists = filesFor(formData, "fighterListUpload");
  if (logos.length === 0) throw new ApplicationError("REQUIRED_FIELD_MISSING", 400, "logoUpload");
  if (logos.length > 1) throw new ApplicationError("TOO_MANY_FILES", 400, "logoUpload");
  if (photos.length === 0) throw new ApplicationError("REQUIRED_FIELD_MISSING", 400, "gymPhotos");
  if (photos.length > FILE_RULES.gymPhotos.maxFiles) throw new ApplicationError("TOO_MANY_FILES", 400, "gymPhotos");
  if (fighterLists.length > 1) throw new ApplicationError("TOO_MANY_FILES", 400, "fighterListUpload");

  const totalSize = [...logos, ...photos, ...fighterLists].reduce((sum, file) => sum + file.size, 0) +
    Array.from(formData.values()).reduce((sum, value) => sum + (typeof value === "string" ? Buffer.byteLength(value) : 0), 0);
  if (totalSize > MAX_REQUEST_BYTES) throw new ApplicationError("REQUEST_TOO_LARGE", 413);

  const logo = await validateFile(logos[0], "logoUpload");
  const gymPhotos = await Promise.all(photos.map((file) => validateFile(file, "gymPhotos")));
  const fighterList = fighterLists[0] ? await validateFile(fighterLists[0], "fighterListUpload") : null;
  const reviewConsent = parseConsent(formData, "reviewConsent", true);
  const followUpConsent = parseConsent(formData, "followUpConsent");
  const bkfcAppAccessInterest = parseConsent(formData, "bkfcAppAccessInterest");
  const normalizedGymName = normalizeIdentity(gymName);
  const normalizedEmail = normalizeIdentity(email);
  const payloadHash = await hashPayload([
    gymName, cityCountry, contactPerson, email, phone, websiteInstagram, disciplinesOffered,
    promoVideoLink, String(reviewConsent), String(followUpConsent), String(bkfcAppAccessInterest),
    logo.file, ...gymPhotos.map(({ file }) => file), ...(fighterList ? [fighterList.file] : []),
  ]);

  return {
    gymName, cityCountry, contactPerson, email, phone, websiteInstagram, disciplinesOffered,
    promoVideoLink, reviewConsent: true, followUpConsent, bkfcAppAccessInterest, idempotencyKey,
    normalizedGymName, normalizedEmail, logo, gymPhotos, fighterList, payloadHash,
  };
}
