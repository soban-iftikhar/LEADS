import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { hashPassword } from "@/lib/auth/hash";
import { rateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";


const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must not exceed 72 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});


export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`reset-password:${ip}`, 10, 1800);

    if (!allowed) {
      return errorResponse(
        "Too many attempts. Please request a new reset link.",
        429
      );
    }

    // Validate input
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        422,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, token, password } = parsed.data;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return errorResponse("Invalid or expired reset link.", 400);
    }
    

    // Check reset token exists
    if (!user.passwordResetToken || !user.passwordResetExpiresAt) {
      return errorResponse("Invalid or expired reset link.", 400);
    }

    // Check token has not expired
    if (new Date() > user.passwordResetExpiresAt) {
      // Clean up expired token
      await prisma.user.update({
        where: { email },
        data: {
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      return errorResponse(
        "This reset link has expired. Please request a new one.",
        400
      );
    }


    const incomingTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const storedTokenHash = user.passwordResetToken;

    const isTokenValid = crypto.timingSafeEqual(
      Buffer.from(incomingTokenHash),
      Buffer.from(storedTokenHash)
    );

    if (!isTokenValid) {
      return errorResponse("Invalid or expired reset link.", 400);
    }

    const isSamePassword = await bcrypt.compare(password, user.passwordHash);

    if (isSamePassword) {
      return errorResponse(
        "New password cannot be the same as your current password",
        400
      );
    }

    // Hash new password
    const newPasswordHash = await hashPassword(password);

    // Update password and clear reset token fields in one atomic operation
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    return successResponse({
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}