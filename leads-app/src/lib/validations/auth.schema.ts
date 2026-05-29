import { z } from "zod";

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(100, "Full name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Full name contains invalid characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(255, "Email is too long"),

  // Phone is optional at signup 
  // When provided, must be a valid Pakistani mobile number format.
  phone: z
    .string()
    .trim()
    .regex(/^03[0-9]{9}$/, "Enter a valid Pakistani phone number (e.g. 03001234567)")
    .optional()
    .or(z.literal("")),

  role: z.enum(["BUYER", "SELLER", "ADMIN"], {
    error: () => ({ message: "Select a valid role" }),
  }),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must not exceed 72 characters") // bcrypt limit
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),

  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;