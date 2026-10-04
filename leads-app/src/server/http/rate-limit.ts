import "server-only";
import { Redis } from "ioredis";
import { env } from "@/server/env";

let client: Redis | undefined;

function redis(): Redis {
  // Created on first use so importing this module never opens a connection (build, tests).
  client ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 });
  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Fixed-window counter: at most `limit` calls per `windowSeconds` for `identifier`.
 * INCR and EXPIRE run in one transaction, so a crash between them cannot leave a
 * counter without an expiry (which would block the caller forever).
 */
export async function rateLimit(
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const results = await redis()
    .multi()
    .incr(key)
    .expire(key, windowSeconds, "NX")
    .exec();

  const current = Number(results?.[0]?.[1] ?? 0);
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
  };
}
