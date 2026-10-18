
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  doctorStatusOf,
  isUniqueViolation,
  publicUser,
  userSelect,
} from "./auth.helpers.js";
import { verifyGoogleIdToken } from "./google.service.js";

export const accountService = {
  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...userSelect,
        authIdentities: { select: { provider: true } },
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError("User not found", 404);
    }

    return {
      user: publicUser(user),
      doctorStatus: await doctorStatusOf(user),
      signInMethods: user.authIdentities.map(
        (i: { provider: string }) => i.provider,
      ),
    };
  },

  async linkGoogle(userId: string, idToken: string) {
    const google = await verifyGoogleIdToken(idToken);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) throw new AppError("User not found", 404);

    // the verified email is the main identifier
    if (google.email !== user.email) {
      throw new AppError(
        "The Google account must use the same email as your account",
        400,
      );
    }

    try {
      await prisma.authIdentity.create({
        data: {
          userId,
          provider: "GOOGLE",
          providerId: google.sub,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new AppError("This Google account is already linked", 409);
      }
      throw e;
    }
  },

  async unlinkIdentity(userId: string, provider: "PASSWORD" | "GOOGLE") {
    try {
      await prisma.$transaction(
        async (tx) => {
          const count = await tx.authIdentity.count({ where: { userId } });

          if (count <= 1) {
            throw new AppError("At least one sign-in method must remain", 400);
          }

          const removed = await tx.authIdentity.deleteMany({
            where: { userId, provider },
          });

          if (removed.count === 0) {
            throw new AppError("Sign-in method not found", 404);
          }
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2034"
      ) {
        throw new AppError("Please try again", 409);
      }

      throw e;
    }
  },
};
