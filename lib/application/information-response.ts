import { createHash, randomBytes } from "node:crypto";

export const INFORMATION_RESPONSE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const INFORMATION_REQUEST_SUMMARY_MAX = 500;
export const INFORMATION_REQUEST_DETAILS_MAX = 4000;
export const INFORMATION_RESPONSE_TEXT_MAX = 6000;
export const INFORMATION_REQUEST_VALID_DAYS = [3, 7, 14, 30] as const;

export function generateInformationResponseToken() {
  return randomBytes(32).toString("base64url");
}

export function hashInformationResponseToken(token: string) {
  if (!INFORMATION_RESPONSE_TOKEN_PATTERN.test(token)) return null;
  return createHash("sha256").update(token).digest("hex");
}

export function validateInformationRequestInput(values: {
  summary: string;
  details: string;
  validDays: number;
}) {
  const summary = values.summary.trim().replace(/\s+/g, " ");
  const details = values.details.trim();
  if (!summary || summary.length > INFORMATION_REQUEST_SUMMARY_MAX) {
    throw new Error("Request summary must be between 1 and 500 characters.");
  }
  if (details.length > INFORMATION_REQUEST_DETAILS_MAX) {
    throw new Error("Request details cannot exceed 4,000 characters.");
  }
  if (!(INFORMATION_REQUEST_VALID_DAYS as readonly number[]).includes(values.validDays)) {
    throw new Error("Select a valid response period.");
  }
  return { summary, details, validDays: values.validDays };
}

export function validateInformationResponseText(value: string) {
  const responseText = value.trim();
  if (!responseText) throw new Error("Please provide the requested information.");
  if (responseText.length > INFORMATION_RESPONSE_TEXT_MAX) {
    throw new Error("Response cannot exceed 6,000 characters.");
  }
  return responseText;
}
