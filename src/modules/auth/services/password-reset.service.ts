
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { hashPassword } from "./password.service.js";
import { otpService } from "./otp.service.js";
import { sendCode, otpInfo } from "./auth.helpers.js";

export const passwordResetService = {
  // Always answers the same, so it cannot be used to find registered emails

async requestPasswordResetOtp(email: string) {


  const user = await prisma.user.findUnique({
    where: { email },
    select: { deletedAt: true },
  });

  if (user && !user.deletedAt) {
    try {

     await sendCode(email, "PASSWORD_RESET");

    } catch (error) {
      console.error("[Password Reset] sendCode failed", error);

      if (
        !(
          error instanceof AppError &&
          error.statusCode === 429
        )
      ) {
        throw error;
      }
    }
  }


  return otpInfo;
},


  // Checks the code without using it (step 2 of the screen)
  async checkPasswordResetOtp(input: { email: string; otp: string }) {
    await otpService.verify({
      email: input.email,
      purpose: "PASSWORD_RESET",
      code: input.otp,
      consume: false,
    });

    return { valid: true };
  },

  // Uses the code and sets the new password (step 3)
  async resetPassword(input: {
    email: string;
    otp: string;
    newPassword: string;
  }) {
    const passwordHash = await hashPassword(input.newPassword);

    await prisma.$transaction(async (tx) => {
      await otpService.verify({
        email: input.email,
        purpose: "PASSWORD_RESET",
        code: input.otp,
        consume: true,
      }, tx);

      const user = await tx.user.findUnique({
        where: { email: input.email },
        select: { id: true, deletedAt: true },
      });

      if (!user || user.deletedAt) {
        throw new AppError("Invalid or expired code", 400);
      }

      // a Google-only user gets a password sign-in method here (email is already verified)
      await tx.authIdentity.upsert({
        where: {
          userId_provider: { userId: user.id, provider: "PASSWORD" },
        },
        create: {
          userId: user.id,
          provider: "PASSWORD",
          providerId: user.id,
          passwordHash,
        },
        update: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  },
};
