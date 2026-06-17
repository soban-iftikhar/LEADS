import sgMail from "@sendgrid/mail";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

const FROM = {
  email: process.env.SENDGRID_FROM_EMAIL!,
  name: process.env.SENDGRID_FROM_NAME || "LEADS",
};

// Generic send email function 
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await sgMail.send({ to, from: FROM, subject, html });
  } catch (error) {
    console.error("SendGrid error:", error);
    throw new Error("Failed to send email");
  }
}

// OTP Email 
export async function sendOtpEmail(
  to: string,
  fullName: string,
  otp: string
) {
  const subject = "Your LEADS Verification Code";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #0D0D0D; padding: 24px; text-align: center;">
        <span style="color: #F97316; font-size: 24px; font-weight: bold;">● LEADS</span>
      </div>
      <div style="padding: 32px; background: #ffffff; border: 1px solid #E5E5E5;">
        <h2 style="color: #0D0D0D; margin-bottom: 8px;">Verify Your Email Address</h2>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${fullName}, use the code below to verify your email address.</p>
        <div style="background: #F8F8F8; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #0D0D0D;">${otp}</span>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color: #6B7280; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
      </div>
      <div style="padding: 16px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px;">© 2026 LEADS — Islamabad, Pakistan</p>
      </div>
    </div>
  `;
  await sendEmail(to, subject, html);
}

// Password Reset Email
export async function sendPasswordResetEmail(
  to: string,
  fullName: string,
  resetUrl: string
) {
  const subject = "Reset Your LEADS Password";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #0D0D0D; padding: 24px; text-align: center;">
        <span style="color: #F97316; font-size: 24px; font-weight: bold;">● LEADS</span>
      </div>
      <div style="padding: 32px; background: #ffffff; border: 1px solid #E5E5E5;">
        <h2 style="color: #0D0D0D; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #6B7280; margin-bottom: 24px;">Hi ${fullName}, click the button below to reset your password.</p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${resetUrl}"
             style="background: #F97316; color: white; padding: 14px 32px; border-radius: 6px;
                    text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6B7280; font-size: 14px;">This link expires in <strong>15 minutes</strong>.</p>
        <p style="color: #6B7280; font-size: 14px;">If you did not request this, you can safely ignore this email.</p>
      </div>
      <div style="padding: 16px; text-align: center;">
        <p style="color: #9CA3AF; font-size: 12px;">© 2026 LEADS — Islamabad, Pakistan</p>
      </div>
    </div>
  `;
  await sendEmail(to, subject, html);
}