import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import crypto from "crypto";
import { sendPasswordResetEmail } from "@/lib/email";

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = await rateLimit(`forgot-password:${ip}`, 3, 3600); // 3 per hour

    if (!allowed) {
      return errorResponse("Too many requests. Please try again later.", 429);
    }

    // Validate input
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        "Validation failed",
        422,
        parsed.error.flatten().fieldErrors,
      );
    }

    const { email } = parsed.data;

    // Find user
    // we always return the same success response whether or not the email exists, to prevent user enumeration attacks.
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Fake success to prevent reveal of whether the email exists in the system
      return successResponse({
        message:
          "If an account exists with this email, a reset link has been sent.",
      });
    }

    // Generate a secure random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const resetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save hashed token to DB
    await prisma.user.update({
      where: { email },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiresAt: resetExpiresAt,
      },
    });

    // Build the reset URL with the RAW token
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}&email=${email}`;

    // Send email via SendGrid
    try {
      await sendPasswordResetEmail(user.fullName, email, resetUrl);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
    }

    return successResponse({
      message:
        "If an account exists with this email, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse("Something went wrong. Please try again.", 500);
  }
}
