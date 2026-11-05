import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { env } from "@/server/env";
import { clientIp } from "./client-ip";
import { AppError, badInput, tooMany } from "./errors";
import { rateLimit } from "./rate-limit";
import { errorResponse } from "./response";

type Limit = { key: string; limit: number; windowSeconds: number };

type Ctx = { request: NextRequest; ip: string };

/**
 * Wraps a route handler: Origin check on writes, rate limits, and error mapping.
 * AppError becomes its own status and message; anything else is logged and returned as a
 * generic 500, never with internals.
 */
export function handle(fn: (ctx: Ctx) => Promise<NextResponse>, opts: { limits?: Limit[] } = {}) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") assertSameOrigin(request);
      const ip = clientIp(request);
      for (const l of opts.limits ?? []) await limit(`${l.key}:ip:${ip}`, l.limit, l.windowSeconds);
      return await fn({ request, ip });
    } catch (e) {
      return toResponse(e);
    }
  };
}

export function toResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    const res = errorResponse(e.message, e.status, e.errors ?? undefined);
    for (const [k, v] of Object.entries(e.headers)) res.headers.set(k, v);
    return res;
  }
  console.error("Unhandled API error:", e);
  return errorResponse("Something went wrong. Please try again.", 500);
}

/** Throws 429 (with Retry-After) once the bucket is over its limit. */
export async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const { allowed } = await rateLimit(key, max, windowSeconds);
  if (!allowed) throw tooMany(windowSeconds);
}

/** Parses a JSON body with a Zod schema; field errors come back as 422 { errors: { field: message } }. */
export async function body<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown = {};
  const text = await request.text();
  if (text.length > 64 * 1024) throw new AppError(413, "That request is too large.");
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError(400, "That request could not be read.");
    }
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const k = String(issue.path[0] ?? "form");
      errors[k] ??= issue.message;
    }
    throw badInput(errors);
  }
  return parsed.data;
}

/**
 * CSRF guard for cookie-authenticated writes (SameSite=Lax plus this check): the Origin, or the
 * Referer when Origin is missing, must be our own site.
 */
function assertSameOrigin(request: NextRequest): void {
  const allowed = new Set([new URL(env().NEXT_PUBLIC_APP_URL).origin, request.nextUrl.origin]);
  const origin = request.headers.get("origin") ?? (request.headers.get("referer") ? new URL(request.headers.get("referer") as string).origin : null);
  if (!origin || !allowed.has(origin)) throw new AppError(403, "This request was blocked.");
}
