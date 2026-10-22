import crypto from "node:crypto";
import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { AUTH_OTP } from "../../../shared/constants/auth.constants.js";
import type { OtpPurpose, Prisma } from "../../../generated/prisma/client.js";

type OtpClient = Prisma.TransactionClient | typeof prisma;

const generateCode = (): string =>
  crypto.randomInt(0, 10 ** AUTH_OTP.LENGTH).toString().padStart(AUTH_OTP.LENGTH, "0");

// HMAC with a server secret: a leaked table cannot be brute-forced offline
const hashCode = (email: string, purpose: OtpPurpose, code: string): string =>
  crypto
    .createHmac("sha256", env.OTP_SECRET)
    .update(`${email}:${purpose}:${code}`)
    .digest("hex");

const invalidCode = () => new AppError("Invalid or expired code", 400);

export const otpService = {
  // Throws 429 if a code was sent less than 60 seconds ago
  async assertCanIssue(email: string, purpose: OtpPurpose): Promise<void> {
    const latest = await prisma.otpCode.findFirst({
      where: { email, purpose },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!latest) return;

    const elapsed = Date.now() - latest.createdAt.getTime();
    if (elapsed < AUTH_OTP.RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((AUTH_OTP.RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new AppError(`Please wait ${wait} seconds before requesting a new code`, 429);
    }
  },

  async issue(input: {
    email: string;
    purpose: OtpPurpose;
    payload?: Prisma.InputJsonValue;
  }): Promise<{ id: string; code: string }> {
    await this.assertCanIssue(input.email, input.purpose);

    const code = generateCode();
    const [, created] = await prisma.$transaction([
      // only one live code per email and purpose
      prisma.otpCode.deleteMany({
        where: { email: input.email, purpose: input.purpose, usedAt: null },
      }),
      prisma.otpCode.create({
        data: {
          email: input.email,
          purpose: input.purpose,
          codeHash: hashCode(input.email, input.purpose, code),
          payload: input.payload,
          expiresAt: new Date(Date.now() + AUTH_OTP.TTL_MS),
        },
        select: { id: true },
      }),
    ]);

    return { id: created.id, code };
  },

  // Used when the email could not be sent
  async discard(id: string): Promise<void> {
    await prisma.otpCode.deleteMany({ where: { id } });
  },

  async latestUnused(email: string, purpose: OtpPurpose, client: OtpClient = prisma) {
    return client.otpCode.findFirst({
      where: { email, purpose, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },

  // consume = true marks the code as used (single use)
  async verify(input: {
    email: string;
    purpose: OtpPurpose;
    code: string;
    consume: boolean;
  }, transactionClient?: Prisma.TransactionClient) {
    const client: OtpClient = transactionClient ?? prisma;
    const record = await this.latestUnused(input.email, input.purpose, client);

    if (!record || record.expiresAt.getTime() < Date.now()) throw invalidCode();

    if (record.attempts >= AUTH_OTP.MAX_ATTEMPTS) {
      throw new AppError("Too many wrong attempts. Please request a new code", 400);
    }

    const expected = Buffer.from(record.codeHash, "hex");
    const actual = Buffer.from(hashCode(input.email, input.purpose, input.code), "hex");
    const matches =
      expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      const updated = await client.otpCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      // the 5th wrong attempt cancels the code
      if (updated.attempts >= AUTH_OTP.MAX_ATTEMPTS) {
        await client.otpCode.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        });
        throw new AppError("Too many wrong attempts. Please request a new code", 400);
      }
      throw invalidCode();
    }

    if (input.consume) {
      // guards against two requests using the same code at once
      const result = await client.otpCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (result.count !== 1) throw invalidCode();
    }

    return record;
  },
};
