import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const resendOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  type: z.enum(["email", "phone"], {
    error: "Type must be either email or phone",
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Strict rate limit — 3 resends per hour per IP
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`resend-otp:${ip}`, 3, 3600);

    if (!allowed) {
      return errorResponse(
        "Too many resend attempts. Please wait before requesting another code.",
        429
      );
    }

    const body = await request.json();
    const parsed = resendOtpSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse("Validation failed", 422, parsed.error.flatten().fieldErrors);
    }

    const { email, type } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Same response whether user exists or not
      return successResponse({
        message: "If your account exists, a new code has been sent.",
      });
    }

    // Check if already verified for the requested channel
    if (type === "email" && user.isEmailVerified) {
      return successResponse({ message: "Your email is already verified." });
    }

    if (type === "phone" && user.isPhoneVerified) {
      return successResponse({ message: "Your phone is already verified." });
    }

    // Generate fresh OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const otpExpiresAt = new Date(
      Date.now() + Number(process.env.OTP_EXPIRY_MINUTES ?? 10) * 60 * 1000
    );

    if (type === "email") {
      await prisma.user.update({
        where: { email },
        data: {
          emailOtpHash: otpHash,
          emailOtpExpiresAt: otpExpiresAt,
          otpAttempts: 0, // Reset attempts on resend
        },
      });

      try {
        await sendOtpEmail(email, user.fullName, otp);
      } catch (emailError) {
        console.error("Failed to resend OTP email:", emailError);
        return errorResponse("Failed to send verification code. Please try again.", 500);
      }
    }

    if (type === "phone") {
      if (!user.phone) {
        return errorResponse(
          "No phone number found on this account. Please add a phone number first.",
          400
        );
      }

      await prisma.user.update({
        where: { email },
        data: {
          phoneOtpHash: otpHash,
          phoneOtpExpiresAt: otpExpiresAt,
          otpAttempts: 0,
        },
      });

      // TODO: Send via SMS gateway
      if (process.env.NODE_ENV === "development") {
        console.log(`[DEV ONLY] Phone OTP for ${user.phone}: ${otp}`);
      }
    }

    return successResponse({
      message: "A new verification code has been sent.",
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}