import type { Role } from "../generated/prisma/client.js";

export type RegisterRole = Extract<Role, "PATIENT" | "DOCTOR">;

// Stored in otp_codes.payload until the OTP is verified
export interface RegisterPayload {
  name: string;
  role: RegisterRole;
  passwordHash: string;
  consentVersion: string;
}

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}