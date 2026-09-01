import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { verifyOtp } from "@/lib/auth/otp";
import { signToken } from "@/lib/auth/jwt";
import { rateLimit } from "@/lib/rate-limit";

const verifyEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must contain only numbers"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limi
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`verify-email:${ip}`, 10, 900);

    if (!allowed) {
      return errorResponse("Too many attempts. Please request a new OTP.", 429);
    }

    // Validate input
    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed", 422, parsed.error.flatten().fieldErrors);
    }

    const { email, otp } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return errorResponse("Invalid request.", 400);
    }

    // Already verified
    if (user.isEmailVerified) {
      return successResponse({ message: "Email is already verified." });
    }

    // Check OTP exists
    if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
      return errorResponse("No verification code found. Please request a new one.", 400);
    }

    // Check OTP expiry
    if (new Date() > user.emailOtpExpiresAt) {
      return errorResponse("Your verification code has expired. Please request a new one.", 400);
    }

    // Verify OTP
    const isValid = await verifyOtp(otp, user.emailOtpHash);

    if (!isValid) {
      // Increment attempt counter
      await prisma.user.update({
        where: { email },
        data: { otpAttempts: { increment: 1 } },
      });

      // Lock account after too many wrong attempts
      if (user.otpAttempts + 1 >= Number(process.env.OTP_MAX_ATTEMPTS ?? 5)) {
        await prisma.user.update({
          where: { email },
          data: {
            emailOtpHash: null,
            emailOtpExpiresAt: null,
            otpAttempts: 0,
          },
        });
        return errorResponse(
          "Too many incorrect attempts. Please request a new verification code.",
          429
        );
      }

      return errorResponse("Incorrect verification code. Please try again.", 400);
    }

    // Mark email as verified and clear OTP fields
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        otpAttempts: 0,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    });

    // Issue JWT so user is immediately logged in after verification
    const token = signToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const response = successResponse({
      message: "Email verified successfully.",
      user: updatedUser,
      token,
    });

    // Set token as httpOnly cookie
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Verify email error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}