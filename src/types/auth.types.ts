import type { Role } from "../generated/prisma/client.js";
import type { AccountStatus, AuthProvider, DoctorApprovalStatus } from "../generated/prisma/client.js";

export interface AuthenticatedAccountSnapshot {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  emailVerified: boolean;
  deletedAt: Date | null;
  authIdentities: Array<{ provider: AuthProvider; updatedAt: Date }>;
  doctorProfile: { approvalStatus: DoctorApprovalStatus } | null;
}

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
