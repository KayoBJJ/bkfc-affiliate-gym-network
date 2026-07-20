export type EnvironmentSource = Record<string, string | undefined>;

export type ConfigCode =
  | "CONFIG_SUPABASE_INVALID"
  | "CONFIG_RATE_LIMIT_INVALID"
  | "CONFIG_EMAIL_INVALID"
  | "CONFIG_PROXY_INVALID";

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
