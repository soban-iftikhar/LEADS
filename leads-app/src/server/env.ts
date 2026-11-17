import "server-only";
import { z } from "zod";

/**
 * Environment variables, validated once on first use (not at import time, so `next build`
 * works without secrets). Read env through `env()` only; a missing or malformed value fails
 * with one clear message instead of an `undefined` deep inside a request.
 */
const base64Key = z.string().refine((v) => Buffer.from(v, "base64").length === 32, "must be base64 of 32 bytes");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  // Signs the short-lived access token (HS256). At least 32 random characters.
  JWT_SECRET: z.string().min(32, "must be at least 32 characters"),

  // Number of reverse proxies in front of the app that append to X-Forwarded-For.
  // 1 = one proxy (nginx, Caddy, a platform load balancer). See http/client-ip.ts.
  TRUSTED_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),

  // Public base URL of the site: email links, OAuth redirect, the Origin check.
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  OTP_EXPIRY_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  // "live" sends codes by email/WhatsApp; "log" only prints them to the server log (local testing,
  // so test runs never message real inboxes or numbers). Ignored in production.
  AUTH_DELIVERY: z.enum(["live", "log"]).default("live"),
  // HMAC key for one-time codes and signed OAuth cookies.
  OTP_PEPPER: base64Key.optional(),

  // Encrypts admin TOTP secrets at rest (DR-38). Required to create or sign in an admin.
  TOTP_ENC_KEY: base64Key.optional(),

  // Google sign-in. Both empty = the Google button is hidden.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Same values as the Python service (python-service/.env).
  PHONE_HASH_PEPPER: base64Key.optional(),
  PHONE_ENC_KEY: base64Key.optional(),

  // "sandbox" confirms card and wallet payments on the spot (local development only; refused in
  // production). Unset = only bank transfer, confirmed by an admin (DR-26, OQ-16).
  PAYMENT_PROVIDER: z.enum(["manual", "sandbox"]).default("manual"),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  // Development without Cloudinary: where uploads are kept on disk (relative to the app folder).
  // Photos must sit under public/ so Next serves them at /uploads/...
  LOCAL_UPLOADS_DIR: z.string().default("public/uploads"),
  LOCAL_DOCUMENTS_DIR: z.string().default(".data/documents"),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-flash-latest"),

  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v20.0"),
  WHATSAPP_OTP_TEMPLATE: z.string().optional(),
  WHATSAPP_OTP_TEMPLATE_LANG: z.string().default("en"),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    // empty strings in .env mean "not set"
    const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const problems = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      throw new Error(`Invalid environment: ${problems}`);
    }
    if (parsed.data.NODE_ENV === "production" && parsed.data.PAYMENT_PROVIDER === "sandbox") {
      throw new Error("Invalid environment: PAYMENT_PROVIDER=sandbox is not allowed in production");
    }
    cached = parsed.data;
  }
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/** Log-only delivery of codes and links (local testing). Never in production. */
export const deliveryIsLogged = () => env().AUTH_DELIVERY === "log" && !isProduction();
