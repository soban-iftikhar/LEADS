// WhatsApp needs international format, digits only, no leading zero (e.g. 923001234567).

/** Strict: returns null unless the input is a valid Pakistani mobile number. */
export function normalizeForWhatsApp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+92")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("0092")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = "92" + digits.slice(1);
  } else if (digits.startsWith("3") && digits.length === 10) {
    digits = "92" + digits;
  }

  return digits.startsWith("92") && digits.length === 12 ? digits : null;
}

/** Lenient: for numbers already validated as 03XXXXXXXXX by the signup schema. */
export function formatPakistaniPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-+]/g, "");
  if (cleaned.startsWith("0")) return "92" + cleaned.slice(1);
  if (cleaned.startsWith("92")) return cleaned;
  return "92" + cleaned;
}

/** For logs: keeps the last three digits only. */
export function maskPhone(phone: string): string {
  return phone.length <= 3 ? "***" : `${"*".repeat(phone.length - 3)}${phone.slice(-3)}`;
}
