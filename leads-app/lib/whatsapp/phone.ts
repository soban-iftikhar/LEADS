// WhatsApp needs international format, digits only, no leading zero (e.g. 923001234567)

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