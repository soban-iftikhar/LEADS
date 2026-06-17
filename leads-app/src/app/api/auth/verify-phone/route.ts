import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { verifyOtp } from "@/lib/auth/otp";
import { rateLimit } from "@/lib/rate-limit";

const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^03[0-9]{9}$/, "Enter a valid Pakistani phone number"),
  otp: z.string().length(6, "OTP must be exactly 6 digits").regex(/^\d+$/, "OTP must contain only numbers"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`verify-phone:${ip}`, 10, 900);

    if (!allowed) {
      return errorResponse("Too many attempts. Please request a new OTP.", 429);
    }

    const body = await request.json();
    const parsed = verifyPhoneSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed", 422, parsed.error.flatten().fieldErrors);
    }

    const { phone, otp } = parsed.data;

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      return errorResponse("Invalid request.", 400);
    }

    if (user.isPhoneVerified) {
      return successResponse({ message: "Phone number is already verified." });
    }

    if (!user.phoneOtpHash || !user.phoneOtpExpiresAt) {
      return errorResponse("No verification code found. Please request a new one.", 400);
    }

    if (new Date() > user.phoneOtpExpiresAt) {
      return errorResponse("Your verification code has expired. Please request a new one.", 400);
    }

    const isValid = await verifyOtp(otp, user.phoneOtpHash);

    if (!isValid) {
      await prisma.user.update({
        where: { phone },
        data: { otpAttempts: { increment: 1 } },
      });

      if (user.otpAttempts + 1 >= Number(process.env.OTP_MAX_ATTEMPTS ?? 5)) {
        await prisma.user.update({
          where: { phone },
          data: {
            phoneOtpHash: null,
            phoneOtpExpiresAt: null,
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

    await prisma.user.update({
      where: { phone },
      data: {
        isPhoneVerified: true,
        phoneOtpHash: null,
        phoneOtpExpiresAt: null,
        otpAttempts: 0,
      },
    });

    return successResponse({
      message: "Phone number verified successfully.",
    });
  } catch (error) {
    console.error("Verify phone error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}