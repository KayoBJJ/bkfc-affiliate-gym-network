import { ApplicationError } from "./policy.ts";

export const BOT_TRAP_FIELD = "q7m2_delta";
export const FORM_STARTED_AT_FIELD = "r4n8_epoch";
export const CLEARLY_IMPOSSIBLE_COMPLETION_MS = 2_000;

function hasMeaningfulTrapValue(formData: FormData) {
  return formData.getAll(BOT_TRAP_FIELD).some((value) =>
    typeof value === "string" ? value.trim().length > 0 : value.size > 0,
  );
}

function isClearlyRapid(formData: FormData, now: number) {
  const values = formData.getAll(FORM_STARTED_AT_FIELD);
  if (values.length !== 1 || typeof values[0] !== "string" || !/^\d{13}$/.test(values[0])) {
    return false;
  }
  const elapsed = now - Number(values[0]);
  return elapsed >= 0 && elapsed < CLEARLY_IMPOSSIBLE_COMPLETION_MS;
}

export function enforceBotSignals(formData: FormData, now = Date.now()) {
  const trapFieldPresent = formData.has(BOT_TRAP_FIELD);
  if (hasMeaningfulTrapValue(formData) || (isClearlyRapid(formData, now) && !trapFieldPresent)) {
    throw new ApplicationError("BOT_DETECTED", 400);
  }
}
