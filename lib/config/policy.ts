export type EnvironmentSource = Record<string, string | undefined>;

export type ConfigCode =
  | "CONFIG_SUPABASE_INVALID"
  | "CONFIG_RATE_LIMIT_INVALID"
  | "CONFIG_EMAIL_INVALID"
  | "CONFIG_PROXY_INVALID"
  | "CONFIG_TURNSTILE_INVALID"
  | "CONFIG_CLEANUP_INVALID"
  | "CONFIG_COMMUNICATION_INVALID"
  | "CONFIG_BKFC_INTEGRATION_INVALID";

export class ConfigurationError extends Error {
  readonly code: ConfigCode;

  constructor(code: ConfigCode) {
    super(code);
    this.name = "ConfigurationError";
    this.code = code;
  }
}

const PLACEHOLDER_PATTERN = /^(change[-_ ]?me|replace[-_ ]?with|placeholder|your[-_ ]|example|dummy|default|secret)(?:[-_ ].*)?$/i;
const EMAIL_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]{2,}$/;

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function isPlaceholder(value: string) {
  return PLACEHOLDER_PATTERN.test(value);
}

function emailAddress(value: string | undefined) {
  if (!value) return undefined;
  const bracketed = value.match(/^[^<>]*<([^<>]+)>$/)?.[1];
  const address = bracketed ?? value;
  if (/@(example\.(com|org|net)|[^@]+\.invalid)$/i.test(address)) return undefined;
  return EMAIL_PATTERN.test(address) ? value : undefined;
}

export function resolvePrivilegedSupabaseConfig(env: EnvironmentSource) {
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  try {
    if (!url || !["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
  } catch {
    throw new ConfigurationError("CONFIG_SUPABASE_INVALID");
  }
  if (!serviceRoleKey || serviceRoleKey.length < 20 || isPlaceholder(serviceRoleKey)) {
    throw new ConfigurationError("CONFIG_SUPABASE_INVALID");
  }
  return { url, serviceRoleKey };
}

export function resolvePublicSupabaseConfig(env: EnvironmentSource) {
  const url = clean(env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = clean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  try {
    if (!url || !["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
  } catch {
    throw new ConfigurationError("CONFIG_SUPABASE_INVALID");
  }
  if (!anonKey || isPlaceholder(anonKey)) throw new ConfigurationError("CONFIG_SUPABASE_INVALID");
  return { url, anonKey };
}

export function resolveRateLimitConfig(env: EnvironmentSource) {
  const secret = clean(env.RATE_LIMIT_HASH_SECRET);
  if (!secret || secret.length < 32 || isPlaceholder(secret) || new Set(secret).size < 8) {
    throw new ConfigurationError("CONFIG_RATE_LIMIT_INVALID");
  }
  return { secret };
}

export type ProxyProvider = "vercel" | "cloudflare" | "none";

export function resolveProxyTrustConfig(env: EnvironmentSource): {
  provider: ProxyProvider;
  valid: boolean;
} {
  if (clean(env.VERCEL_ENV)) return { provider: "vercel", valid: true };
  const configured = clean(env.TRUSTED_PROXY_PROVIDER)?.toLocaleLowerCase("en-US");
  if (!configured) return { provider: "none", valid: true };
  if (configured === "cloudflare") return { provider: "cloudflare", valid: true };
  return { provider: "none", valid: false };
}

export type EmailSkipCode =
  | "CONFIG_EMAIL_INVALID"
  | "EMAIL_TEST_DELIVERY_SKIPPED"
  | "INTERNAL_NOTIFICATION_SKIPPED";

export type EmailDeliveryPlan = {
  enabled: boolean;
  recipient?: string;
  from?: string;
  replyTo?: string;
  skipCode?: EmailSkipCode;
};

function enabledFlag(value: string | undefined) {
  const normalized = clean(value)?.toLocaleLowerCase("en-US");
  if (!normalized || normalized === "false") return { enabled: false, valid: true };
  if (normalized === "true") return { enabled: true, valid: true };
  return { enabled: false, valid: false };
}

function integrationSecret(value: string | undefined) {
  const secret = clean(value);
  return secret && secret.length >= 43 && !isPlaceholder(secret) && new Set(secret).size >= 12
    ? secret
    : undefined;
}

function integrationFlag(value: string | undefined) {
  const flag = enabledFlag(value);
  if (!flag.valid) throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  return flag.enabled;
}

export type BkfcIntegrationConfig = {
  submissionEnabled: boolean;
  paymentCallbackEnabled: boolean;
  paymentDeliveryEnabled: boolean;
  bkfcToEuSecrets: readonly string[];
  euToBkfcCurrentSecret?: string;
  euToBkfcPreviousSecret?: string;
  paymentRequestBaseUrl?: string;
  consentNoticeVersionAllowlist: ReadonlySet<string>;
  orphanCleanupEnabled: boolean;
  orphanCleanupDryRun: boolean;
  orphanCleanupBatchSize: number;
};

export function resolveBkfcIntegrationConfig(env: EnvironmentSource): BkfcIntegrationConfig {
  const submissionEnabled = integrationFlag(env.BKFC_SUBMISSION_INTEGRATION_ENABLED);
  const paymentCallbackEnabled = integrationFlag(env.BKFC_PAYMENT_CALLBACK_ENABLED);
  const paymentDeliveryEnabled = integrationFlag(env.BKFC_PAYMENT_REQUEST_DELIVERY_ENABLED);
  const orphanCleanupEnabled = integrationFlag(env.BKFC_INTEGRATION_ORPHAN_CLEANUP_ENABLED);
  const orphanCleanupDryRunFlag = enabledFlag(env.BKFC_INTEGRATION_ORPHAN_CLEANUP_DRY_RUN ?? "true");
  if (!orphanCleanupDryRunFlag.valid) throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  const bkfcCurrent = integrationSecret(env.BKFC_TO_EU_BEARER_SECRET_CURRENT);
  const bkfcPrevious = integrationSecret(env.BKFC_TO_EU_BEARER_SECRET_PREVIOUS);
  const euCurrent = integrationSecret(env.EU_TO_BKFC_BEARER_SECRET_CURRENT);
  const euPrevious = integrationSecret(env.EU_TO_BKFC_BEARER_SECRET_PREVIOUS);
  const consentNoticeVersionAllowlist = new Set(
    (clean(env.BKFC_CONSENT_NOTICE_VERSION_ALLOWLIST) ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(entry)),
  );

  if (
    (clean(env.BKFC_TO_EU_BEARER_SECRET_CURRENT) && !bkfcCurrent) ||
    (clean(env.BKFC_TO_EU_BEARER_SECRET_PREVIOUS) && !bkfcPrevious) ||
    (clean(env.EU_TO_BKFC_BEARER_SECRET_CURRENT) && !euCurrent) ||
    (clean(env.EU_TO_BKFC_BEARER_SECRET_PREVIOUS) && !euPrevious) ||
    (bkfcCurrent && bkfcPrevious && bkfcCurrent === bkfcPrevious) ||
    (euCurrent && euPrevious && euCurrent === euPrevious) ||
    [bkfcCurrent, bkfcPrevious].some((secret) => secret && [euCurrent, euPrevious].includes(secret))
  ) {
    throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  }

  let paymentRequestBaseUrl: string | undefined;
  const configuredBaseUrl = clean(env.BKFC_PAYMENT_REQUEST_BASE_URL);
  if (configuredBaseUrl) {
    try {
      const url = new URL(configuredBaseUrl);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        (url.pathname !== "/" && url.pathname !== "")) throw new Error();
      paymentRequestBaseUrl = url.origin;
    } catch {
      throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
    }
  }

  if ((submissionEnabled || paymentCallbackEnabled) && !bkfcCurrent) {
    throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  }
  if (submissionEnabled && consentNoticeVersionAllowlist.size === 0) {
    throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  }
  if (paymentDeliveryEnabled && (!euCurrent || !paymentRequestBaseUrl)) {
    throw new ConfigurationError("CONFIG_BKFC_INTEGRATION_INVALID");
  }

  return {
    submissionEnabled,
    paymentCallbackEnabled,
    paymentDeliveryEnabled,
    bkfcToEuSecrets: [bkfcCurrent, bkfcPrevious].filter((value): value is string => Boolean(value)),
    euToBkfcCurrentSecret: euCurrent,
    euToBkfcPreviousSecret: euPrevious,
    paymentRequestBaseUrl,
    consentNoticeVersionAllowlist,
    orphanCleanupEnabled,
    orphanCleanupDryRun: orphanCleanupDryRunFlag.enabled,
    orphanCleanupBatchSize: positiveInteger(
      env.BKFC_INTEGRATION_ORPHAN_CLEANUP_BATCH_SIZE, 50, 1, 500, "CONFIG_BKFC_INTEGRATION_INVALID",
    ),
  };
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  code: ConfigCode = "CONFIG_CLEANUP_INVALID",
) {
  if (!clean(value)) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ConfigurationError(code);
  }
  return parsed;
}

export function resolveApplicantCommunicationConfig(env: EnvironmentSource) {
  const enabled = enabledFlag(env.APPLICANT_COMMUNICATIONS_ENABLED);
  const dryRun = enabledFlag(env.APPLICANT_COMMUNICATIONS_DRY_RUN ?? "true");
  const tokenSecret = clean(env.APPLICANT_COMMUNICATION_TOKEN_SECRET);
  if (!enabled.valid || !dryRun.valid) {
    throw new ConfigurationError("CONFIG_COMMUNICATION_INVALID");
  }
  if (
    enabled.enabled &&
    (!tokenSecret || tokenSecret.length < 32 || isPlaceholder(tokenSecret) || new Set(tokenSecret).size < 8)
  ) {
    throw new ConfigurationError("CONFIG_COMMUNICATION_INVALID");
  }
  return {
    enabled: enabled.enabled,
    dryRun: dryRun.enabled,
    batchSize: positiveInteger(
      env.APPLICANT_COMMUNICATION_BATCH_SIZE,
      10,
      1,
      25,
      "CONFIG_COMMUNICATION_INVALID",
    ),
    tokenSecret,
  };
}

export function resolveTurnstileConfig(env: EnvironmentSource) {
  const secretKey = clean(env.TURNSTILE_SECRET_KEY);
  const proofSecret = clean(env.TURNSTILE_PROOF_SECRET);
  const expectedHostnames = (clean(env.TURNSTILE_EXPECTED_HOSTNAMES) ?? "")
    .split(",")
    .map((value) => value.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean);
  if (!secretKey || secretKey.length < 20 || isPlaceholder(secretKey) ||
    !proofSecret || proofSecret.length < 32 || isPlaceholder(proofSecret) || new Set(proofSecret).size < 8 ||
    proofSecret === secretKey || !expectedHostnames.length ||
    expectedHostnames.some((hostname) => hostname.includes("/") || hostname.includes(":") || hostname.includes("*"))) {
    throw new ConfigurationError("CONFIG_TURNSTILE_INVALID");
  }
  return { secretKey, proofSecret, expectedHostnames: [...new Set(expectedHostnames)] };
}

export function resolveCleanupConfig(env: EnvironmentSource) {
  const cronSecret = clean(env.CRON_SECRET);
  const dryRunFlag = enabledFlag(env.APPLICATION_CLEANUP_DRY_RUN ?? "true");
  if (!cronSecret || cronSecret.length < 32 || isPlaceholder(cronSecret) || new Set(cronSecret).size < 8 || !dryRunFlag.valid) {
    throw new ConfigurationError("CONFIG_CLEANUP_INVALID");
  }
  return {
    cronSecret,
    dryRun: dryRunFlag.enabled,
    abandonedSessionHours: positiveInteger(env.APPLICATION_ABANDONED_SESSION_HOURS, 24, 1, 24 * 30),
    failedSessionHours: positiveInteger(env.APPLICATION_FAILED_SESSION_HOURS, 24, 1, 24 * 30),
    finalizedSessionDays: positiveInteger(env.APPLICATION_FINALIZED_SESSION_DAYS, 30, 1, 365),
    anonymousUserDays: positiveInteger(env.APPLICATION_ANONYMOUS_USER_DAYS, 7, 1, 365),
    batchSize: positiveInteger(env.APPLICATION_CLEANUP_BATCH_SIZE, 50, 1, 100),
  };
}

export function resolveEmailRouting(applicantEmail: string, env: EnvironmentSource) {
  const flag = enabledFlag(env.APPLICANT_EMAIL_DELIVERY_ENABLED);
  const providerApiKey = clean(env.RESEND_API_KEY);
  const providerConfigured = Boolean(providerApiKey && providerApiKey.length >= 16 && !isPlaceholder(providerApiKey));
  const from = emailAddress(clean(env.APPLICANT_EMAIL_FROM));
  const internalRecipient = emailAddress(clean(env.INTERNAL_NOTIFICATION_RECIPIENT));
  const testRecipient = emailAddress(clean(env.APPLICANT_EMAIL_TEST_RECIPIENT));
  const replyTo = emailAddress(clean(env.APPLICANT_EMAIL_REPLY_TO));

  const internal: EmailDeliveryPlan = providerConfigured && from && internalRecipient
    ? { enabled: true, recipient: internalRecipient, from }
    : { enabled: false, skipCode: internalRecipient ? "CONFIG_EMAIL_INVALID" : "INTERNAL_NOTIFICATION_SKIPPED" };

  let applicant: EmailDeliveryPlan;
  if (!flag.valid || !providerConfigured || !from) {
    applicant = { enabled: false, skipCode: "CONFIG_EMAIL_INVALID" };
  } else if (flag.enabled) {
    applicant = replyTo && EMAIL_PATTERN.test(applicantEmail)
      ? { enabled: true, recipient: applicantEmail, from, replyTo }
      : { enabled: false, skipCode: "CONFIG_EMAIL_INVALID" };
  } else {
    applicant = testRecipient
      ? { enabled: true, recipient: testRecipient, from }
      : { enabled: false, skipCode: "EMAIL_TEST_DELIVERY_SKIPPED" };
  }

  return {
    applicantDeliveryEnabled: flag.enabled,
    providerApiKey: providerConfigured ? providerApiKey : undefined,
    internal,
    applicant,
    subjectPrefix: flag.enabled ? "" : "[TEST MODE] ",
  };
}
