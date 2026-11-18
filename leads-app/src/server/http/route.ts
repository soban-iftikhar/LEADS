import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { authFromRequest } from "@/server/auth/current";
import { can, needsVerifiedEmail, type Permission } from "@/server/auth/permissions";
import type { Auth } from "@/server/auth/session";
import { env } from "@/server/env";
import { clientIp } from "./client-ip";
import { AppError, badInput, forbidden, notFound, unauthenticated } from "./errors";
import { limit } from "./rate-limit";
import { fail } from "./response";
import { isUuid } from "@/lib/ids";

/**
 * Every API route handler is written with `route()` (SPEC_02 5.2). In order:
 * Origin check on writes → IP rate limits → session → permission → body/query validation →
 * handler → error mapping. An `AppError` becomes its own status and message; anything else is
 * logged and answered with a generic 500, never with internals.
 *
 *   export const POST = route({ auth: "listing:create", body: createSchema, handler: async ({ auth, body }) => ok(...) });
 */

type Limit = { key: string; limit: number; windowSeconds: number };
type AuthMode = "public" | "session" | Permission;
type Params = Record<string, string | string[] | undefined>;

type Ctx<A extends AuthMode, B, Q, P extends Params> = {
  request: NextRequest;
  ip: string;
  params: P;
  body: B;
  query: Q;
  auth: A extends "public" ? Auth | null : Auth;
};

type Options<A extends AuthMode, BS extends z.ZodType | undefined, QS extends z.ZodType | undefined, P extends Params> = {
  /** "public" (anyone, auth loaded if present), "session" (signed in), or a permission. */
  auth: A;
  body?: BS;
  query?: QS;
  limits?: Limit[];
  /** Skip the Origin check: only for server-to-server callers that authenticate otherwise. */
  crossOrigin?: boolean;
  /** Largest accepted JSON body in bytes. */
  maxBodyBytes?: number;
  handler: (ctx: Ctx<A, BS extends z.ZodType ? z.infer<BS> : undefined, QS extends z.ZodType ? z.infer<QS> : undefined, P>) => Promise<Response>;
};

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function route<A extends AuthMode, BS extends z.ZodType | undefined = undefined, QS extends z.ZodType | undefined = undefined, P extends Params = Params>(
  opts: Options<A, BS, QS, P>,
) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<Response> => {
    try {
      if (WRITE.has(request.method) && !opts.crossOrigin) assertSameOrigin(request);
      const ip = clientIp(request);
      for (const l of opts.limits ?? []) await limit(`${l.key}:ip:${ip}`, l.limit, l.windowSeconds);

      const auth = await authFromRequest(request);
      if (opts.auth !== "public") authorize(auth, opts.auth);

      const body = opts.body ? await parseBody(request, opts.body, opts.maxBodyBytes) : undefined;
      const query = opts.query ? parse(opts.query, Object.fromEntries(request.nextUrl.searchParams)) : undefined;
      const params = (await context?.params) ?? ({} as P);
      assertIdParams(params);

      const res = await opts.handler({ request, ip, params, body, query, auth } as Ctx<A, never, never, P>);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

function authorize(auth: Auth | null, mode: Exclude<AuthMode, "public">): asserts auth is Auth {
  if (!auth) throw unauthenticated();
  if (auth.user.role === "ADMIN" && !auth.session.twoFactorPassed) throw new AppError(401, "Finish two-step sign-in first.");
  if (mode === "session") return;
  if (!can(auth.user.role, mode)) throw forbidden();
  if (needsVerifiedEmail(mode) && !auth.user.emailVerifiedAt) throw new AppError(403, "Confirm your email first.", { requiresEmailVerification: "true" });
}

export function toErrorResponse(e: unknown): NextResponse {
  if (e instanceof AppError) {
    const res = fail(e.message, e.status, e.errors);
    for (const [k, v] of Object.entries(e.headers)) res.headers.set(k, v);
    return res;
  }
  console.error("[api] unhandled error:", e);
  return fail("Something went wrong. Please try again.", 500);
}

/** Path segments named `id` or `…Id` are database ids: anything else is simply not found. */
function assertIdParams(params: Params): void {
  for (const [k, v] of Object.entries(params)) {
    if ((k === "id" || k.endsWith("Id")) && typeof v === "string" && !isUuid(v)) throw notFound();
  }
}

function parse<S extends z.ZodType>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  throw badInput(errors);
}

async function parseBody<S extends z.ZodType>(request: Request, schema: S, maxBytes = 64 * 1024): Promise<z.infer<S>> {
  const text = await request.text();
  if (text.length > maxBytes) throw new AppError(413, "That request is too large.");
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError(400, "That request could not be read.");
    }
  }
  return parse(schema, raw);
}

/**
 * CSRF guard for cookie-authenticated writes (SameSite=Lax plus this check): the Origin, or the
 * Referer when Origin is missing, must be our own site.
 */
function assertSameOrigin(request: NextRequest): void {
  const allowed = new Set([new URL(env().NEXT_PUBLIC_APP_URL).origin, request.nextUrl.origin]);
  let origin = request.headers.get("origin");
  if (!origin) {
    const referer = request.headers.get("referer");
    try {
      origin = referer ? new URL(referer).origin : null;
    } catch {
      origin = null;
    }
  }
  if (!origin || !allowed.has(origin)) throw new AppError(403, "This request was blocked.");
}
