import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import { loginSchema } from "@/server/modules/auth/schema";
import { verifyPassword } from "@/server/auth/password";
import { startSession } from "@/server/auth/session";
import { successResponse, errorResponse } from "@/server/http/response";
import { rateLimit } from "@/server/http/rate-limit";
import { clientIp } from "@/server/http/client-ip";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit login attempts — brute force protection
    const ip = clientIp(request);
    const { allowed } = await rateLimit(`login:${ip}`, 10, 900); // 10 per 15 min

    if (!allowed) {
      return errorResponse(
        "Too many login attempts. Please try again in a few minutes.",
        429
      );
    }

    // 2. Validate input
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        422,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;

    // Second limit keyed on the account, so rotating addresses cannot brute-force one user.
    const perAccount = await rateLimit(`login:email:${email}`, 10, 900);
    if (!perAccount.allowed) {
      return errorResponse(
        "Too many login attempts. Please try again in a few minutes.",
        429
      );
    }

    // 3. Find user
    const user = await prisma.legacyUser.findUnique({ where: { email } });

    // Generic error message regardless of whether email exists or
    // password is wrong — prevents user enumeration (security NFR).
    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    // 4. Verify password
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      return errorResponse("Invalid email or password", 401);
    }

    // 5. Check account status
    if (!user.isActive) {
      return errorResponse(
        "This account has been suspended. Contact support for help.",
        403
      );
    }

    // 6. Check email verification — mandatory per our verification strategy
    if (!user.isEmailVerified) {
      return errorResponse(
        "Please verify your email address before logging in.",
        403,
        { requiresEmailVerification: true } // lets frontend redirect to OTP screen
      );
    }

    // 7. Return user data (never include passwordHash or OTP fields)
    const response = successResponse({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });

    // 8. Sign in: the token lives only in an httpOnly cookie, never in the response body,
    // so page scripts (and anything injected into them) cannot read it.
    startSession(response, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}