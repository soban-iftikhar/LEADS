import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Simple sliding-window rate limiter.
 * Example: limit registration attempts to 5 per hour per IP.
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, windowSeconds);
  }

  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}