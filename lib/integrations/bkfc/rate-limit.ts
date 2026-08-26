export type IntegrationRateLimitDirection = "submission_preparse" | "submission" | "callback";

export type TokenBucketState = {
  tokens: number;
  lastRefillMs: number;
};

const POLICY: Record<IntegrationRateLimitDirection, { capacity: number; tokensPerSecond: number }> = {
  submission_preparse: { capacity: 10, tokensPerSecond: 1 },
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
