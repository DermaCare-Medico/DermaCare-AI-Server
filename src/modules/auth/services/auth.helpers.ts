import "dotenv/config";

import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { AUTH_OTP } from "../../../shared/constants/auth.constants.js";
import { sendOtpEmail } from "../../../shared/services/email.service.js";
import {
  AccountStatus,
  Prisma,
  Role,
} from "../../../generated/prisma/client.js";
import type {
  RegisterRole,
  RequestMeta,
} from "../../../types/auth.types.js";
import { otpService } from "./otp.service.js";
import { issueSession } from "./token.service.js";

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  deletedAt: true,
} as const;

export type DbUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
  emailVerified: boolean;
  deletedAt: Date | null;
};

export const publicUser = (u: DbUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  status: u.status,
  emailVerified: u.emailVerified,
});

export const isUniqueViolation = (e: unknown): boolean =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export const assertActive = (user: DbUser): void => {
  if (user.deletedAt) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.status !== AccountStatus.ACTIVE) {
    throw new AppError("Your account is not active", 403);
  }
};

// NO_PROFILE: the doctor has not added license details yet
export const doctorStatusOf = async (
  user: DbUser,
): Promise<string | undefined> => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: user.id },
    select: { approvalStatus: true },
  });

  if (profile) return profile.approvalStatus;
  return user.role === Role.DOCTOR ? "NO_PROFILE" : undefined;
};

// DOCTOR is registration intent. Accounts remain ordinary patients until an
// administrator approves the submitted DoctorProfile.
export const accountRoleForRegistration = (role: RegisterRole): Role =>
  role === Role.DOCTOR ? Role.USER : Role.PATIENT;

export const startSession = async (user: DbUser, meta: RequestMeta) => {
  assertActive(user);

  const [tokens, doctorStatus] = await Promise.all([
    issueSession(user, meta),
    doctorStatusOf(user),
  ]);

  return { user: publicUser(user), doctorStatus, ...tokens };
};

type CreateAccountInput = {
  name: string;
  email: string;
  role: RegisterRole;
  consentVersion: string;
  identity:
    | { provider: "PASSWORD"; passwordHash: string }
    | { provider: "GOOGLE"; sub: string };
};

const createAccountWithClient = async (
  input: CreateAccountInput,
  tx: Prisma.TransactionClient,
): Promise<DbUser> => {
  const now = new Date();
  const accountRole = accountRoleForRegistration(input.role);

  const user = await tx.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: accountRole,
      emailVerified: true,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      healthConsentAcceptedAt: now,
      consentVersion: input.consentVersion,
    },
    select: userSelect,
  });

  await tx.authIdentity.create({
    data:
      input.identity.provider === "PASSWORD"
        ? {
            userId: user.id,
            provider: "PASSWORD",
            providerId: user.id,
            passwordHash: input.identity.passwordHash,
          }
        : {
            userId: user.id,
            provider: "GOOGLE",
            providerId: input.identity.sub,
          },
  });

  if (accountRole === Role.PATIENT) {
    await tx.patientProfile.create({ data: { userId: user.id } });
  }

  return user;
};

export const createAccount = async (
  input: CreateAccountInput,
  transactionClient?: Prisma.TransactionClient,
): Promise<DbUser> => {
  try {
    return transactionClient
      ? await createAccountWithClient(input, transactionClient)
      : await prisma.$transaction((tx) => createAccountWithClient(input, tx));
  } catch (e) {
    if (isUniqueViolation(e)) {
      throw new AppError("An account with this email already exists", 409);
    }

    throw e;
  }
};

export const sendCode = async (
  email: string,
  purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET",
  payload?: Prisma.InputJsonValue,
): Promise<void> => {
  const { id, code } = await otpService.issue({
    email,
    purpose,
    payload,
  });

  try {
    await sendOtpEmail(email, code, purpose);
  } catch (e) {
    try {
      await otpService.discard(id);
    } catch (discardError) {
      console.error("[sendCode] Failed to discard OTP", discardError);
    }

    throw e;
  }
};

export const otpInfo = {
  expiresInSeconds: AUTH_OTP.TTL_MS / 1000,
  resendAfterSeconds: AUTH_OTP.RESEND_COOLDOWN_MS / 1000,
};
