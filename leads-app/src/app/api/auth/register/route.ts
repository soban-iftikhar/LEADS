import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth.schema";
import { hashPassword } from "@/lib/auth/hash";
import { successResponse, errorResponse } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { generateOtp, hashOtp } from "@/lib/auth/otp";
import { sendOtpEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting — prevent registration spam/abuse
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`register:${ip}`, 5, 3600); // 5 per hour

    if (!allowed) {
      return errorResponse(
        "Too many registration attempts. Please try again later.",
        429,
      );
    }

    // 2. Parse and validate input
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        422,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { fullName, email, phone, role, password } = parsed.data;

    // 3. Check email uniqueness (case-insensitive, already lowercased by Zod)
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Generic message — do not reveal whether it's the email specifically
      // that's taken, to avoid user enumeration attacks (security NFR).
      return errorResponse("An account with this email already exists", 409);
    }

    // 4. Check phone uniqueness only if provided
    if (phone) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone },
      });

      if (existingPhone) {
        return errorResponse(
          "An account with this phone number already exists",
          409,
        );
      }
    }

    // 5. Hash password — never store plain text
    const passwordHash = await hashPassword(password);

    // 6. Generate email OTP (hashed before storage — never store raw OTP)
    const emailOtp = generateOtp();
    const emailOtpHash = await hashOtp(emailOtp);
    const emailOtpExpiresAt = new Date(
      Date.now() + Number(process.env.OTP_EXPIRY_MINUTES ?? 10) * 60 * 1000,
    );

    // 7. Create user record
    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone: phone || null,
        role,
        passwordHash,
        emailOtpHash,
        emailOtpExpiresAt,
        isEmailVerified: false,
        isPhoneVerified: false,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        // passwordHash and OTP fields intentionally excluded from response
      },
    });

    // send emailOtp via SendGrid
    try {
      await sendOtpEmail(email, fullName, emailOtp);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
    }
    return successResponse(
      {
        user,
        message: "Registration successful. Please verify your email.",
      },
      201,
    );
  } catch (error) {
    console.error("Register error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
