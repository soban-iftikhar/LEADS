export async function sendOtpSms(phone: string, otp: string) {
  // TODO: Replace with a real SMS gateway before production
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEV ONLY - SMS PENDING] Phone OTP for ${phone}: ${otp}`);
  }
}