import "server-only";
import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Google sign-in, OpenID Connect authorization-code flow with PKCE (DR-43). No library: two
 * HTTPS calls to Google. The ID token comes straight from Google's token endpoint over TLS with
 * our client secret, so per OIDC Core 3.1.3.7 its claims are checked rather than its signature.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const STATE_COOKIE = "leads_oauth";
export const PENDING_COOKIE = "leads_oauth_pending";
export const OAUTH_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };

export function googleEnabled(): boolean {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  return !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;
}

export const redirectUri = () => `${env().NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

const b64u = (b: Buffer) => b.toString("base64url");

function key(): Buffer {
  const p = env().OTP_PEPPER;
  if (!p) throw new Error("OTP_PEPPER is not set");
  return crypto.createHash("sha256").update(`oauth-cookie:${p}`).digest();
}

/** value.signature, so a cookie we set can't be edited by the browser. */
export function sign(data: object): string {
  const v = b64u(Buffer.from(JSON.stringify(data)));
  return `${v}.${b64u(crypto.createHmac("sha256", key()).update(v).digest())}`;
}

export function unsign<T>(raw: string | undefined): T | null {
  if (!raw) return null;
  const [v, sig] = raw.split(".");
  if (!v || !sig) return null;
  const want = crypto.createHmac("sha256", key()).update(v).digest();
  const got = Buffer.from(sig, "base64url");
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(v, "base64url").toString()) as T & { exp?: number };
    if (data.exp && data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export type OAuthState = { state: string; verifier: string; type: "seller" | "agency" | null; next: string; exp: number };

export function startAuth(type: OAuthState["type"], next: string) {
  const state = b64u(crypto.randomBytes(24));
  const verifier = b64u(crypto.randomBytes(48));
  const challenge = b64u(crypto.createHash("sha256").update(verifier).digest());
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: sign({ state, verifier, type, next, exp: Date.now() + 10 * 60_000 } satisfies OAuthState) };
}

export type GoogleClaims = { sub: string; email: string; name: string };

/** Exchanges the code and returns the verified identity, or throws. */
export async function finishAuth(code: string, verifier: string): Promise<GoogleClaims> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID as string, client_secret: GOOGLE_CLIENT_SECRET as string, redirect_uri: redirectUri(), grant_type: "authorization_code", code_verifier: verifier }),
  });
  if (!res.ok) throw new Error(`Google token endpoint returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { id_token: idToken } = (await res.json()) as { id_token?: string };
  if (!idToken) throw new Error("No id_token from Google");
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as {
    iss?: string;
    aud?: string;
    exp?: number;
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    given_name?: string;
  };
  if (payload.iss !== "https://accounts.google.com" && payload.iss !== "accounts.google.com") throw new Error("Bad issuer");
  if (payload.aud !== GOOGLE_CLIENT_ID) throw new Error("Bad audience");
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error("Expired id_token");
  if (!payload.sub || !payload.email) throw new Error("Missing claims");
  if (payload.email_verified !== true && payload.email_verified !== "true") throw new Error("Google email not verified");
  const email = payload.email.trim().toLowerCase();
  return { sub: payload.sub, email, name: (payload.name || payload.given_name || email.split("@")[0]).slice(0, 100) };
}
