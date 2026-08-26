export type IntegrationRateLimitDirection = "submission" | "callback";

export type TokenBucketState = {
  tokens: number;
  lastRefillMs: number;
};

const POLICY: Record<IntegrationRateLimitDirection, { capacity: number; tokensPerSecond: number }> = {
  submission: { capacity: 10, tokensPerSecond: 1 },
  callback: { capacity: 50, tokensPerSecond: 5 },
};

export function consumeTokenBucket(
  direction: IntegrationRateLimitDirection,
  prior: TokenBucketState | undefined,
  nowMs: number,
): { allowed: boolean; retryAfterSeconds: number; state: TokenBucketState } {
  const policy = POLICY[direction];
  const elapsedSeconds = Math.max(0, (nowMs - (prior?.lastRefillMs ?? nowMs)) / 1000);
  const available = Math.min(policy.capacity, (prior?.tokens ?? policy.capacity) + elapsedSeconds * policy.tokensPerSecond);
  if (available >= 1) {
    return { allowed: true, retryAfterSeconds: 0, state: { tokens: available - 1, lastRefillMs: nowMs } };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((1 - available) / policy.tokensPerSecond)),
    state: { tokens: available, lastRefillMs: nowMs },
  };
}

export type CredentialRateLimiter = {
  consume: (credentialFingerprint: string, nowMs?: number) => {
    allowed: boolean;
    retryAfterSeconds: number;
  };
};

export function createCredentialRateLimiter(
  direction: IntegrationRateLimitDirection,
  maximumTrackedCredentials = 4,
): CredentialRateLimiter {
  const states = new Map<string, TokenBucketState>();
  return {
    consume(credentialFingerprint, nowMs = Date.now()) {
      const result = consumeTokenBucket(direction, states.get(credentialFingerprint), nowMs);
      states.delete(credentialFingerprint);
      states.set(credentialFingerprint, result.state);
      while (states.size > maximumTrackedCredentials) {
        const oldest = states.keys().next().value;
        if (oldest === undefined) break;
        states.delete(oldest);
      }
      return { allowed: result.allowed, retryAfterSeconds: result.retryAfterSeconds };
    },
  };
}
