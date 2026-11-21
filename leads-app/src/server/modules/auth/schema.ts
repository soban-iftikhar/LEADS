import { z } from "zod";

// Shared by the auth routes and the client forms, so both show the same messages.

const email = z.string().trim().toLowerCase().email("Enter a valid email, like you@example.com.").max(255, "That email is too long.");

/** 8+ characters with a number; 72 bytes max (bcrypt only reads 72). */
export const password = z
  .string()
  .min(8, "Use 8 or more characters with a number.")
  .refine((v) => /\d/.test(v), "Use 8 or more characters with a number.")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "That password is too long.");

/** Pakistani mobile, any common way of typing it: 03001234567, 3001234567, +92 300 1234567. */
export const phone = z
  .string()
  .trim()
  .transform((v) => {
    let d = v.replace(/\D/g, "");
    if (d.startsWith("0092")) d = d.slice(4);
    else if (d.startsWith("92") && d.length === 12) d = d.slice(2);
    if (d.length === 10 && d.startsWith("3")) d = "0" + d;
    return d;
  })
  .refine((d) => /^03\d{9}$/.test(d), "Enter a 10-digit mobile number, like 300 1234567.");

// Only customer kinds can sign up here. ADMIN is not a value anywhere in these schemas.
export const customerKind = z.enum(["SELLER", "AGENCY"], { error: () => ({ message: "Pick Owner or Agency." }) });

export const registerSchema = z
  .object({
    kind: customerKind,
    displayName: z.string().trim().min(2, "Please enter a name.").max(100, "That name is too long."),
    contactPerson: z.string().trim().max(100).optional(),
    email,
    password,
    acceptTerms: z.literal(true, { error: () => ({ message: "Please accept the terms to continue." }) }),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "AGENCY" && (!v.contactPerson || v.contactPerson.length < 3)) {
      ctx.addIssue({ code: "custom", path: ["contactPerson"], message: "Please enter your full name." });
    }
    if (v.kind === "SELLER" && v.displayName.length < 3) {
      ctx.addIssue({ code: "custom", path: ["displayName"], message: "Please enter your full name." });
    }
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(200),
  remember: z.boolean().default(true),
});

export const codeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter all 6 digits.") });
export const otpSchema = z.object({ otp: z.string().trim().regex(/^\d{6}$/, "Enter all 6 digits.") });
export const phoneSchema = z.object({ phone });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1, "Enter your current password."), newPassword: password });
export const deleteMeSchema = z.object({ password: z.string().min(1, "Enter your password.") });

export const updateMeSchema = z.object({
  displayName: z.string().trim().min(2, "Please enter a name.").max(100).optional(),
  contactPerson: z.string().trim().min(3, "Please enter your full name.").max(100).optional(),
  email: email.optional(),
  /** region slug of the owner's home city; null clears it */
  city: z.string().trim().max(60).nullable().optional(),
});

export const prefsSchema = z
  .object({
    newLeadWhatsapp: z.boolean(),
    dailySummary: z.boolean(),
    listingUpdates: z.boolean(),
    emailCopies: z.boolean(),
    packageEnding: z.boolean(),
  })
  .partial();

export const googleCompleteSchema = z
  .object({ kind: customerKind, agencyName: z.string().trim().max(100).optional(), acceptTerms: z.literal(true, { error: () => ({ message: "Please accept the terms to continue." }) }) })
  .superRefine((v, ctx) => {
    if (v.kind === "AGENCY" && (!v.agencyName || v.agencyName.length < 2)) ctx.addIssue({ code: "custom", path: ["agencyName"], message: "What is your agency called?" });
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
