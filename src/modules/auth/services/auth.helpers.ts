
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { AUTH_OTP } from "../../../shared/constants/auth.constants.js";
import { sendOtpEmail } from "../../../shared/services/email.service.js";
import { AccountStatus, NotificationType, Prisma, Role } from "../../../generated/prisma/client.js";
import type { RegisterPayload, RegisterRole, RequestMeta } from "../../../types/auth.types.js";
import { otpService } from "./otp.service.js";
import { issueSession } from "./token.service.js";
import { createNotification } from "../../notifications/services/notification.service.js";

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
  if (user.deletedAt) throw new AppError("Invalid email or password", 401);
  if (user.status === "SUSPENDED") {
    throw new AppError("Your account is suspended", 403);
  }
};

// NO_PROFILE: the doctor has not added license details yet
export const doctorStatusOf = async (
  user: DbUser,
): Promise<string | undefined> => {
  if (user.role !== "DOCTOR") return undefined;

  const profile = await prisma.doctorProfile.findUnique({
    where: { userId: user.id },
    select: { approvalStatus: true },
  });

  return profile?.approvalStatus ?? "NO_PROFILE";
};

export const startSession = async (user: DbUser, meta: RequestMeta) => {
  assertActive(user);

  const [tokens, doctorStatus] = await Promise.all([
    issueSession(user, meta),
    doctorStatusOf(user),
  ]);

  return { user: publicUser(user), doctorStatus, ...tokens };
};

export const createAccount = async (input: {
  name: string;
  email: string;
  role: RegisterRole;
  consentVersion: string;
  identity:
    | { provider: "PASSWORD"; passwordHash: string }
    | { provider: "GOOGLE"; sub: string };
  notifyAdminsOfDoctorRegistration?: boolean;
}): Promise<DbUser> => {
  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();

      const user = await tx.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
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

      // a Patient is active immediately; a Doctor adds license details later
      if (input.role === "PATIENT") {
        await tx.patientProfile.create({ data: { userId: user.id } });
      }

      if (input.role === "DOCTOR" && input.notifyAdminsOfDoctorRegistration) {
        const admins = await tx.user.findMany({
          where: {
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
          },
          select: { id: true },
        });

        for (const admin of admins) {
          await createNotification({
            userId: admin.id,
            title: "New doctor registration",
            message: "A new doctor account has completed registration.",
            notificationType: NotificationType.ACCOUNT,
            relatedEntityType: "User",
            relatedEntityId: user.id,
          }, tx);
        }
      }

      return user;
    });
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
  const { id, code } = await otpService.issue({ email, purpose, payload });

  try {
    await sendOtpEmail(email, code, purpose);
  } catch (e) {
    await otpService.discard(id);
    throw e;
  }
};

export const otpInfo = {
  expiresInSeconds: AUTH_OTP.TTL_MS / 1000,
  resendAfterSeconds: AUTH_OTP.RESEND_COOLDOWN_MS / 1000,
};
