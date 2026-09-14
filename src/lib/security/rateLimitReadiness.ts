/**
 * Production contract (PRODUCT-SPEC) requires Redis/Upstash sliding-window
 * rate limiting on route handlers. Gate 6 deliberately does not fake this.
 *
 * Anonymous: max 5 complete triage encounters per IP/device per 24h.
 * Authenticated/BYOK: platform abuse limits only.
 */

export type RateLimitReadiness = {
  configured: false;
  status: "NOT_CONFIGURED";
  requiredByContract: true;
  releaseBlocker: true;
  redisOrUpstashConfigured: false;
  message: string;
};

type EnvLike = Record<string, string | undefined>;

export function getRateLimitReadiness(
  env: EnvLike = process.env,
): RateLimitReadiness {
  const redisConfigured = Boolean(
    env.UPSTASH_REDIS_REST_URL?.trim() ||
      env.REDIS_URL?.trim() ||
      env.RATE_LIMIT_REDIS_URL?.trim(),
  );

  // Even if a Redis URL is present, no route-handler limiter is wired yet.
  void redisConfigured;

  return {
    configured: false,
    status: "NOT_CONFIGURED",
    requiredByContract: true,
    releaseBlocker: true,
    redisOrUpstashConfigured: false,
    message:
      "Redis/Upstash sliding-window rate limiting is required by the production contract but is not implemented on route handlers. Do not ship production traffic until this is configured and enforced.",
  };
}
