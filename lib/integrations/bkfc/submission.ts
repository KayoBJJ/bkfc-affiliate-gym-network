import { createHash } from "node:crypto";
import { canonicalSha256, type CanonicalJson } from "./canonical-json.ts";
import { BKFC_APPLICATION_ID_PATTERN, IntegrationError, UUID_V4_PATTERN } from "./contracts.ts";

export const BKFC_SUBMISSION_MAX_BYTES = 4_718_592;
export const BKFC_LOGO_MAX_BYTES = 3_145_728;

const TEXT_FIELDS = {
  gymName: { required: true, max: 200 },
  contactPerson: { required: true, max: 150 },
  address: { required: false, max: 200 },
  city: { required: true, max: 100 },
  state: { required: false, max: 100 },
  postalCode: { required: false, max: 20 },
  country: { required: true, max: 100 },
  email: { required: true, max: 200 },
  phone: { required: true, max: 50 },
  website: { required: false, max: 300 },
  instagram: { required: false, max: 300 },
  disciplinesOffered: { required: true, max: 2_000 },
  promoVideoLink: { required: false, max: 500 },
  plan: { required: true, max: 9 },
  consentNoticeVersion: { required: true, max: 64 },
} as const;

const ALLOWED_FIELDS = new Set([
  ...Object.keys(TEXT_FIELDS), "logoUpload", "bkfcAppAccessInterest", "reviewConsent", "followUpConsent",
]);

type LogoMediaType = "image/png" | "image/jpeg" | "image/webp";
export type ValidatedBkfcLogo = {
  file: File;
  extension: "png" | "jpg" | "jpeg" | "webp";
  mediaType: LogoMediaType;
  sizeBytes: number;
  sha256: string;
};

export type ValidatedBkfcSubmission = {
  bkfcApplicationId: string;
  idempotencyKey: string;
  requestId: string;
  gymName: string;
  contactPerson: string;
  address: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  email: string;
  phone: string;
  website: string | null;
  instagram: string | null;
  disciplines: string[];
  promoVideoLink: string | null;
  plan: "monthly" | "quarterly";
  bkfcAppAccessInterest: boolean;
  reviewConsent: true;
  followUpConsent: boolean;
  consentNoticeVersion: string;
  logo: ValidatedBkfcLogo;
  payloadHash: string;
  canonicalPayload: CanonicalJson;
};

function normalizedText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function field(form: FormData, name: keyof typeof TEXT_FIELDS) {
  const values = form.getAll(name);
  const rule = TEXT_FIELDS[name];
  if (values.length === 0) {
    if (rule.required) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, name);
    return "";
  }
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new IntegrationError("VALIDATION_FAILED", 400, name);
  }
  const value = normalizedText(values[0]);
  if (rule.required && !value) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, name);
  if (value.length > rule.max) throw new IntegrationError("FIELD_TOO_LONG", 400, name);
  return value;
}

function rawDisciplinesField(form: FormData) {
  const values = form.getAll("disciplinesOffered");
  if (values.length === 0) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, "disciplinesOffered");
  if (values.length !== 1 || typeof values[0] !== "string") {
    throw new IntegrationError("VALIDATION_FAILED", 400, "disciplinesOffered");
  }
  if (values[0].length > TEXT_FIELDS.disciplinesOffered.max) {
    throw new IntegrationError("FIELD_TOO_LONG", 400, "disciplinesOffered");
  }
  return values[0];
}

export function parseDisciplinesOffered(raw: string) {
  if (raw.length > TEXT_FIELDS.disciplinesOffered.max) {
    throw new IntegrationError("FIELD_TOO_LONG", 400, "disciplinesOffered");
  }
  const disciplines = raw.split(/[,;\n]/).map(normalizedText).filter(Boolean);
  if (disciplines.length === 0) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, "disciplinesOffered");
  // The BKFC form limits the complete field to 2,000 characters, without per-item limits.
  return disciplines;
}

function checkbox(form: FormData, name: string, required = false) {
  const values = form.getAll(name);
  if (values.length === 0) {
    if (required) throw new IntegrationError("INVALID_CONSENT", 400, name);
    return false;
  }
  if (values.length !== 1 || values[0] !== "on") throw new IntegrationError("INVALID_CONSENT", 400, name);
  return true;
}

function normalizedUrl(value: string, name: string, instagram = false) {
  if (!value) return null;
  if (instagram && /^@?[A-Za-z0-9._]{1,30}$/.test(value) && !/instagram\.com$/i.test(value)) {
    return `https://www.instagram.com/${value.replace(/^@/, "")}/`;
  }
  try {
    const acceptsBareHost = name === "website" || instagram;
    const candidate = acceptsBareHost && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
      ? `https://${value}` : value;
    const url = new URL(candidate);
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".") || url.username || url.password) throw new Error();
    if (instagram && !/(^|\.)instagram\.com$/i.test(url.hostname)) throw new Error();
    return url.toString();
  } catch {
    throw new IntegrationError("INVALID_URL", 400, name);
  }
}

function extension(name: string) {
  return name.toLocaleLowerCase("en-US").match(/\.([a-z0-9]+)$/)?.[1] ?? "";
}

function signature(bytes: Uint8Array): { family: "png" | "jpeg" | "webp"; mediaType: LogoMediaType } | null {
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    .every((byte, index) => bytes[index] === byte)) return { family: "png", mediaType: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { family: "jpeg", mediaType: "image/jpeg" };
  }
  if (bytes.length >= 12 && Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
    Buffer.from(bytes.slice(8, 12)).toString() === "WEBP") return { family: "webp", mediaType: "image/webp" };
  return null;
}

async function logo(form: FormData): Promise<ValidatedBkfcLogo> {
  const values = form.getAll("logoUpload");
  if (values.length === 0) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, "logoUpload");
  if (values.length !== 1 || !(values[0] instanceof File)) throw new IntegrationError("VALIDATION_FAILED", 400, "logoUpload");
  const file = values[0];
  if (file.size === 0) throw new IntegrationError("REQUIRED_FIELD_MISSING", 400, "logoUpload");
  if (file.size > BKFC_LOGO_MAX_BYTES) throw new IntegrationError("FILE_TOO_LARGE", 413, "logoUpload");
  const ext = extension(file.name);
  if (!["png", "jpg", "jpeg", "webp"].includes(ext)) throw new IntegrationError("UNSUPPORTED_FILE_TYPE", 415, "logoUpload");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type.toLocaleLowerCase("en-US"))) {
    throw new IntegrationError("UNSUPPORTED_FILE_TYPE", 415, "logoUpload");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = signature(bytes);
  const expectedFamily = ext === "jpg" || ext === "jpeg" ? "jpeg" : ext;
  if (!detected || detected.family !== expectedFamily || detected.mediaType !== file.type.toLocaleLowerCase("en-US")) {
    throw new IntegrationError("INVALID_FILE_SIGNATURE", 415, "logoUpload");
  }
  return {
    file,
    extension: ext as ValidatedBkfcLogo["extension"],
    mediaType: detected.mediaType,
    sizeBytes: file.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function validateBkfcSubmission(input: {
  form: FormData;
  bkfcApplicationId: string;
  idempotencyKey: string;
  requestId: string;
  consentNoticeVersionAllowlist: ReadonlySet<string>;
}): Promise<ValidatedBkfcSubmission> {
  if (!BKFC_APPLICATION_ID_PATTERN.test(input.bkfcApplicationId)) {
    throw new IntegrationError("VALIDATION_FAILED", 400, "X-BKFC-Application-ID");
  }
  if (!UUID_V4_PATTERN.test(input.idempotencyKey)) throw new IntegrationError("VALIDATION_FAILED", 400, "Idempotency-Key");
  if (!UUID_V4_PATTERN.test(input.requestId)) throw new IntegrationError("VALIDATION_FAILED", 400, "X-Request-ID");
  for (const key of input.form.keys()) {
    if (!ALLOWED_FIELDS.has(key)) throw new IntegrationError("UNEXPECTED_FIELD", 400,
      /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(key) ? key : "unknownField");
  }

  const gymName = field(input.form, "gymName");
  const contactPerson = field(input.form, "contactPerson");
  const address = field(input.form, "address") || null;
  const city = field(input.form, "city");
  const state = field(input.form, "state") || null;
  const postalCode = field(input.form, "postalCode") || null;
  const country = field(input.form, "country");
  const email = field(input.form, "email").toLocaleLowerCase("en-US");
  const phone = field(input.form, "phone");
  const website = normalizedUrl(field(input.form, "website"), "website");
  const instagram = normalizedUrl(field(input.form, "instagram"), "instagram", true);
  const rawDisciplines = rawDisciplinesField(input.form);
  const disciplines = parseDisciplinesOffered(rawDisciplines);
  const promoVideoLink = normalizedUrl(field(input.form, "promoVideoLink"), "promoVideoLink");
  const plan = field(input.form, "plan");
  const consentNoticeVersion = field(input.form, "consentNoticeVersion");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new IntegrationError("INVALID_EMAIL", 400, "email");
  if (!/^\+?[0-9][0-9\s()./-]{6,49}$/.test(phone) || (phone.match(/\d/g)?.length ?? 0) < 7) {
    throw new IntegrationError("INVALID_PHONE", 400, "phone");
  }
  if (plan !== "monthly" && plan !== "quarterly") throw new IntegrationError("INVALID_PLAN", 400, "plan");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(consentNoticeVersion) ||
    !input.consentNoticeVersionAllowlist.has(consentNoticeVersion)) {
    throw new IntegrationError("INVALID_CONSENT", 400, "consentNoticeVersion");
  }
  const reviewConsent = checkbox(input.form, "reviewConsent", true);
  const followUpConsent = checkbox(input.form, "followUpConsent");
  const bkfcAppAccessInterest = checkbox(input.form, "bkfcAppAccessInterest");
  const validatedLogo = await logo(input.form);
  const canonicalPayload: CanonicalJson = {
    contractVersion: 1, sourceSystem: "bkfc", bkfcApplicationId: input.bkfcApplicationId,
    gymName, contactPerson, address, city, state, postalCode, country, email, phone,
    website, instagram, disciplinesOffered: disciplines, promoVideoLink, plan,
    bkfcAppAccessInterest, reviewConsent, followUpConsent, consentNoticeVersion,
    logo: { mediaType: validatedLogo.mediaType, sizeBytes: validatedLogo.sizeBytes, sha256: validatedLogo.sha256 },
  };
  return {
    bkfcApplicationId: input.bkfcApplicationId, idempotencyKey: input.idempotencyKey,
    requestId: input.requestId, gymName, contactPerson, address, city, state, postalCode,
    country, email, phone, website, instagram, disciplines, promoVideoLink,
    plan, bkfcAppAccessInterest, reviewConsent: true, followUpConsent,
    consentNoticeVersion, logo: validatedLogo, canonicalPayload,
    payloadHash: canonicalSha256(canonicalPayload),
  };
}

export function compatibilityLocation(city: string, state: string | null, country: string) {
  return [city, state, country].filter(Boolean).join(", ");
}

export function compatibilityWebsite(website: string | null, instagram: string | null) {
  return [website, instagram].filter(Boolean).join(" | ");
}

export function normalizedDuplicateIdentity(value: string) {
  return normalizedText(value).toLocaleLowerCase("en-US");
}
