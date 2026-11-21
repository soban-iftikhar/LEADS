import "server-only";
import crypto from "node:crypto";
import { Redis } from "ioredis";
import { env } from "@/server/env";
import { tooMany } from "./errors";

let client: Redis | undefined;

function redis(): Redis {
  // Created on first use so importing this module never opens a connection (build, tests).
  client ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 });
  return client;
}

/**
 * Sliding-window limit (never trusts caller-supplied headers; see client-ip.ts): at most `max` calls in any `windowSeconds` span.
 * One sorted set per bucket holds the call times; old entries are trimmed and the new one is
 * added in a single MULTI, so concurrent calls cannot slip past the count.
 */
export async function rateLimit(identifier: string, max: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rl:${identifier}`;
  const now = Date.now();
  const res = await redis()
    .multi()
    .zremrangebyscore(key, 0, now - windowSeconds * 1000)
    .zadd(key, now, `${now}:${crypto.randomBytes(4).toString("hex")}`)
    .zcard(key)
    .pexpire(key, windowSeconds * 1000)
    .exec();
  const count = Number(res?.[2]?.[1] ?? 0);
  return { allowed: count <= max, remaining: Math.max(0, max - count) };
}

/** Throws 429 (with Retry-After) once the bucket is over its limit. */
export async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { allowed } = await rateLimit(key, max, windowSeconds);
  if (!allowed) throw tooMany(windowSeconds);
}

/** Calls counted in the current window, without adding one. */
export async function peekRateLimit(identifier: string, windowSeconds: number): Promise<number> {
  const key = `rl:${identifier}`;
  await redis().zremrangebyscore(key, 0, Date.now() - windowSeconds * 1000);
  return redis().zcard(key);
}

/** Records one call (for counters that only count failures). */
export async function hitRateLimit(identifier: string, windowSeconds: number): Promise<void> {
  await rateLimit(identifier, Number.MAX_SAFE_INTEGER, windowSeconds);
}
