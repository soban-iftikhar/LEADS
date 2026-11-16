import { NextResponse } from "next/server";
import { ua } from "@/server/auth/current";
import { setSessionCookie } from "@/server/auth/sessions";
import { body, handle, limit } from "@/server/http/handler";
import { successResponse } from "@/server/http/response";
import { registerSchema } from "@/server/modules/auth/schema";
import { register } from "@/server/modules/auth/service";

// POST /api/auth/register -> 201 { userId } + session cookie; a 6-digit code goes to the email.
export const POST = handle(
  async ({ request, ip }) => {
    const input = await body(request, registerSchema);
    await limit(`register:email:${input.email}`, 3, 3600);
    const { userId, session } = await register(input, { userAgent: ua(request), ip });
    const res = successResponse({ userId }, 201) as NextResponse;
    setSessionCookie(res, session);
    return res;
  },
  { limits: [{ key: "register", limit: 5, windowSeconds: 3600 }] },
);
