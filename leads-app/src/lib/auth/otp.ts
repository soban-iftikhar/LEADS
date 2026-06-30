import crypto from "crypto";

export function generateOtp(length = 6): string {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[crypto.randomInt(0, digits.length)];
  }
  return otp;
}

// OTPs are short-lived and low-entropy by nature, so a fast hash
// (sha256) is appropriate here — bcrypt would be unnecessarily slow
// for something that expires in 10 minutes.
export async function hashOtp(otp: string): Promise<string> {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function verifyOtp(otp: string, hashedOtp: string): Promise<boolean> {
  const hash = await hashOtp(otp);
  return hash === hashedOtp;
}