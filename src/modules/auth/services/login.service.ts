
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { RegisterRole, RequestMeta } from "../../../types/auth.types.js";
import {
  assertActive,
  createAccount,
  isUniqueViolation,
  startSession,
  userSelect,
} from "./auth.helpers.js";
import {
  burnPasswordCheck,
  verifyPassword,
} from "./password.service.js";
import { verifyGoogleIdToken } from "./google.service.js";
import { CONSENT_VERSION } from "../../../shared/constants/auth.constants.js";

export const loginService = {
  async login(input: { email: string; password: string }, meta: RequestMeta) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      select: {
        ...userSelect,
        authIdentities: {
          where: { provider: "PASSWORD" },
          select: { passwordHash: true },
        },
      },
    });

    const hash = user?.authIdentities[0]?.passwordHash;

    if (!user || user.deletedAt || !hash) {
      await burnPasswordCheck(input.password);
      throw new AppError("Invalid email or password", 401);
    }

    if (!(await verifyPassword(hash, input.password))) {
      throw new AppError("Invalid email or password", 401);
    }

    return startSession(user, meta);
  },

  async googleAuth(
    input: {
      idToken: string;
      role?: RegisterRole;
      acceptTerms?: boolean;
      acceptPrivacy?: boolean;
      acceptHealthConsent?: boolean;
    },
    meta: RequestMeta,
  ) {
    const google = await verifyGoogleIdToken(input.idToken);

    // 1. this Google account is already linked
    const linked = await prisma.authIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: "GOOGLE",
          providerId: google.sub,
        },
      },
      select: { user: { select: userSelect } },
    });

    if (linked) {
      return {
        isNewUser: false as const,
        ...(await startSession(linked.user, meta)),
      };
    }

    // 2. the email already has an account: link Google to it
    const existing = await prisma.user.findUnique({
      where: { email: google.email },
      select: userSelect,
    });

    if (existing) {
      assertActive(existing);

      try {
        await prisma.authIdentity.create({
          data: {
            userId: existing.id,
            provider: "GOOGLE",
            providerId: google.sub,
          },
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          throw new AppError("A different Google account is already linked", 409);
        }
        throw e;
      }

      return {
        isNewUser: false as const,
        ...(await startSession(existing, meta)),
      };
    }

    // 3. brand new user: the client must send a role and consent
    if (!input.role) return { isNewUser: true as const };

    if (!input.acceptTerms || !input.acceptPrivacy || !input.acceptHealthConsent) {
      throw new AppError(
        "You must accept the Terms, Privacy Policy and Consent",
        400,
      );
    }

    const user = await createAccount({
      name: google.name,
      email: google.email,
      role: input.role,
      consentVersion: CONSENT_VERSION,
      identity: { provider: "GOOGLE", sub: google.sub },
    });

    return {
      isNewUser: false as const,
      ...(await startSession(user, meta)),
    };
  },
};
