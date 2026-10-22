import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { CONSENT_VERSION } from "../../../shared/constants/auth.constants.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { hashPassword } from "./password.service.js";
import { otpService } from "./otp.service.js";
import type {
  RegisterPayload,
  RegisterRole,
  RequestMeta,
} from "../../../types/auth.types.js";
import { createAccount, otpInfo, sendCode, startSession } from "./auth.helpers.js";

export const registrationService = {
  async requestRegistrationOtp(input: {
    role: RegisterRole;
    name: string;
    email: string;
    password: string;
  }) {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError("An account with this email already exists", 409);
    }

    // cheap cooldown check first, so spam does not trigger expensive hashing
    await otpService.assertCanIssue(input.email, "EMAIL_VERIFICATION");

    const payload: RegisterPayload = {
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
      consentVersion: CONSENT_VERSION,
    };

    await sendCode(
      input.email,
      "EMAIL_VERIFICATION",
      payload as unknown as Prisma.InputJsonValue,
    );

    return otpInfo;
  },

  async resendRegistrationOtp(email: string) {
    const pending = await otpService.latestUnused(email, "EMAIL_VERIFICATION");

    if (!pending?.payload) {
      throw new AppError("No pending registration. Please start again", 404);
    }

    await sendCode(
      email,
      "EMAIL_VERIFICATION",
      pending.payload as unknown as Prisma.InputJsonValue,
    );

    return otpInfo;
  },

  async verifyRegistration(
    input: { email: string; otp: string },
    meta: RequestMeta,
  ) {
    const user = await prisma.$transaction(async (tx) => {
      const record = await otpService.verify({
        email: input.email,
        purpose: "EMAIL_VERIFICATION",
        code: input.otp,
        consume: true,
      }, tx);

      const payload = record.payload as unknown as RegisterPayload | null;
      if (!payload) throw new AppError("Invalid or expired code", 400);

      return createAccount({
        name: payload.name,
        email: input.email,
        role: payload.role,
        consentVersion: payload.consentVersion,
        identity: {
          provider: "PASSWORD",
          passwordHash: payload.passwordHash,
        },
      }, tx);
    });

    return startSession(user, meta);
  },
};
