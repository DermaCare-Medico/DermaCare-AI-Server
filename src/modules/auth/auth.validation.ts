import { z } from "zod";
import { AppError } from "../../shared/errors/AppError.js";

const email = z.string().trim().toLowerCase().email().max(255);

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/[0-9]/, "Password must contain a number");

const otp = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

const accepted = (message: string) =>
  z.boolean().refine((v) => v === true, message);

const role = z.enum(["PATIENT", "DOCTOR"]);

export const registerRequestSchema = z.object({
  role,
  name: z.string().trim().min(2).max(150),
  email,
  password,
  acceptTerms: accepted("You must accept the Terms"),
  acceptPrivacy: accepted("You must accept the Privacy Policy"),
  acceptHealthConsent: accepted("You must accept the Consent"),
});

export const emailOnlySchema = z.object({ email });

export const verifyOtpSchema = z.object({ email, otp });

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

// role + consent are only needed the first time a Google user signs up
export const googleAuthSchema = z.object({
  idToken: z.string().min(20),
  role: role.optional(),
  acceptTerms: z.boolean().optional(),
  acceptPrivacy: z.boolean().optional(),
  acceptHealthConsent: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  email,
  otp,
  newPassword: password,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});

export const linkGoogleSchema = z.object({ idToken: z.string().min(20) });

export const providerParamSchema = z.object({
  provider: z.enum(["PASSWORD", "GOOGLE"]),
});

export function parse<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    const text = issue?.message ?? "Invalid input";
    throw new AppError(field ? `${field}: ${text}` : text, 400);
  }
  return result.data;
}