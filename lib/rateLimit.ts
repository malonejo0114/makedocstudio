type RateLimitConfig = {
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const current = store.get(key);

  if (!current || now >= current.resetAt) {
    const resetAt = now + config.windowMs;
    const next: Bucket = { count: 1, resetAt };
    store.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(config.limit - 1, 0),
      resetAt,
    };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  store.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(config.limit - current.count, 0),
    resetAt: current.resetAt,
  };
}
