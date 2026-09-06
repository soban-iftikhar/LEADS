import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth.schema";
import { verifyPassword } from "@/lib/auth/hash";
import { signToken } from "@/lib/auth/jwt";
import { successResponse, errorResponse } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limit login attempts — brute force protection
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
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

    // 3. Find user
    const user = await prisma.user.findUnique({ where: { email } });

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

    // 7. Issue JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 8. Return user data (never include passwordHash or OTP fields)
    return successResponse({
      token,
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
  } catch (error) {
    console.error("Login error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}