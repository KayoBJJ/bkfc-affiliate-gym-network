import { resolveEmailRouting, type EnvironmentSource } from "../config/policy.ts";

export function resolveReceiptConfig(env: EnvironmentSource) {
  const mode = env.BKFC_APPLICATION_RECEIPTS_MODE?.trim() ?? "disabled";
  if (!["disabled", "dry-run", "test", "live"].includes(mode)) throw new Error("RECEIPT_CONFIG_INVALID");
  const testReference = env.BKFC_APPLICATION_RECEIPTS_TEST_REFERENCE?.trim() || null;
  if (mode === "test" && !testReference) throw new Error("RECEIPT_TEST_REFERENCE_REQUIRED");
  return { enabled: mode !== "disabled", dryRun: mode === "dry-run", mode, testReference, batchSize: 10 };
}

export function resolveReceiptRouting(email: string, env: EnvironmentSource) {
  const config = resolveReceiptConfig(env);
  // Receipt activation must not enable the older direct-email or portal flows.
  return resolveEmailRouting(email, {
    ...env,
    APPLICANT_EMAIL_DELIVERY_ENABLED: config.mode === "live" ? "true" : "false",
  });
}
