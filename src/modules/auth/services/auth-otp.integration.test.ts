import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";

import { env } from "../../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import { CONSENT_VERSION } from "../../../shared/constants/auth.constants.js";
import type { OtpPurpose, Prisma, Role } from "../../../generated/prisma/client.js";
import type { RegisterPayload } from "../../../types/auth.types.js";
import { otpService } from "./otp.service.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import { passwordResetService } from "./password-reset.service.js";
import { registrationService } from "./registration.service.js";

if (process.env.RUN_AUTH_DB_INTEGRATION !== "1") {
  test.skip("Auth database integration tests require RUN_AUTH_DB_INTEGRATION=1", () => {});
  process.exit(0);
}

const runTag = `auth-otp-it-${crypto.randomUUID()}`;
const emails = {
  registration: `${runTag}-registration@example.test`,
  registrationFailure: `${runTag}-registration-failure@example.test`,
  passwordReset: `${runTag}-password-reset@example.test`,
  passwordResetFailure: `${runTag}-password-reset-failure@example.test`,
  concurrent: `${runTag}-concurrent@example.test`,
  doctor: `${runTag}-doctor@example.test`,
  admin: `${runTag}-admin@example.test`,
};
const fixtureEmails = Object.values(emails);
const code = "482731";
const meta = { userAgent: runTag, ipAddress: "127.0.0.1" };

const hashOtp = (email: string, purpose: OtpPurpose) =>
  crypto.createHmac("sha256", env.OTP_SECRET).update(`${email}:${purpose}:${code}`).digest("hex");

const createOtp = async (
  email: string,
  purpose: OtpPurpose,
  payload?: Prisma.InputJsonValue,
) => prisma.otpCode.create({
  data: {
    email,
    purpose,
    codeHash: hashOtp(email, purpose),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    payload,
  },
});

const registrationPayload = async (role: Extract<Role, "PATIENT" | "DOCTOR">) => ({
  name: `${runTag} ${role}`,
  role,
  passwordHash: await hashPassword("Integration123"),
  consentVersion: CONSENT_VERSION,
} satisfies RegisterPayload);

const createPasswordUser = async (email: string, deletedAt: Date | null = null) => {
  const passwordHash = await hashPassword("BeforeReset123");
  const user = await prisma.user.create({
    data: {
      name: runTag,
      email,
      role: "PATIENT",
      emailVerified: true,
      deletedAt,
      authIdentities: {
        create: {
          provider: "PASSWORD",
          providerId: crypto.randomUUID(),
          passwordHash,
        },
      },
    },
  });
  return { user, passwordHash };
};

before(async () => {
  const collisions = await prisma.user.count({ where: { email: { in: fixtureEmails } } });
  assert.equal(collisions, 0, "unique integration fixture tag collided with existing users");
});

after(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: fixtureEmails } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { relatedEntityId: { in: userIds } },
        ],
      },
    });
    await tx.patientProfile.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.otpCode.deleteMany({ where: { email: { in: fixtureEmails } } });
  });
  await prisma.$disconnect();
});

test("registration commits account, session, and single-use OTP", async () => {
  const payload = await registrationPayload("PATIENT");
  const otp = await createOtp(
    emails.registration,
    "EMAIL_VERIFICATION",
    payload as unknown as Prisma.InputJsonValue,
  );

  const result = await registrationService.verifyRegistration(
    { email: emails.registration, otp: code },
    meta,
  );

  const storedOtp = await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } });
  const sessions = await prisma.refreshToken.count({ where: { userId: result.user.id } });
  assert.ok(storedOtp.usedAt);
  assert.equal(sessions, 1);
  await assert.rejects(
    registrationService.verifyRegistration({ email: emails.registration, otp: code }, meta),
  );
});

test("failed registration rolls OTP consumption back", async () => {
  await prisma.user.create({
    data: {
      name: runTag,
      email: emails.registrationFailure,
      role: "PATIENT",
      emailVerified: true,
    },
  });
  const payload = await registrationPayload("PATIENT");
  const otp = await createOtp(
    emails.registrationFailure,
    "EMAIL_VERIFICATION",
    payload as unknown as Prisma.InputJsonValue,
  );

  await assert.rejects(
    registrationService.verifyRegistration(
      { email: emails.registrationFailure, otp: code },
      meta,
    ),
  );

  const storedOtp = await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } });
  assert.equal(storedOtp.usedAt, null);
  await otpService.verify({
    email: emails.registrationFailure,
    purpose: "EMAIL_VERIFICATION",
    code,
    consume: false,
  });
});

test("password reset commits password update and session revocation", async () => {
  const { user } = await createPasswordUser(emails.passwordReset);
  await prisma.refreshToken.createMany({
    data: [1, 2].map((index) => ({
      userId: user.id,
      tokenHash: crypto.createHash("sha256").update(`${runTag}-${index}`).digest("hex"),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const otp = await createOtp(emails.passwordReset, "PASSWORD_RESET");

  await passwordResetService.resetPassword({
    email: emails.passwordReset,
    otp: code,
    newPassword: "AfterReset123",
  });

  const identity = await prisma.authIdentity.findUniqueOrThrow({
    where: { userId_provider: { userId: user.id, provider: "PASSWORD" } },
  });
  const activeSessions = await prisma.refreshToken.count({
    where: { userId: user.id, revokedAt: null },
  });
  const storedOtp = await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } });
  assert.equal(await verifyPassword(identity.passwordHash!, "AfterReset123"), true);
  assert.equal(activeSessions, 0);
  assert.ok(storedOtp.usedAt);
});

test("failed password reset rolls OTP consumption back", async () => {
  const { user, passwordHash } = await createPasswordUser(
    emails.passwordResetFailure,
    new Date(),
  );
  const otp = await createOtp(emails.passwordResetFailure, "PASSWORD_RESET");

  await assert.rejects(passwordResetService.resetPassword({
    email: emails.passwordResetFailure,
    otp: code,
    newPassword: "ShouldNotPersist123",
  }));

  const storedOtp = await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id } });
  const identity = await prisma.authIdentity.findUniqueOrThrow({
    where: { userId_provider: { userId: user.id, provider: "PASSWORD" } },
  });
  assert.equal(storedOtp.usedAt, null);
  assert.equal(identity.passwordHash, passwordHash);
});

test("concurrent OTP verification permits exactly one consumer", async () => {
  await createOtp(emails.concurrent, "PASSWORD_RESET");

  const results = await Promise.allSettled([
    otpService.verify({
      email: emails.concurrent,
      purpose: "PASSWORD_RESET",
      code,
      consume: true,
    }),
    otpService.verify({
      email: emails.concurrent,
      purpose: "PASSWORD_RESET",
      code,
      consume: true,
    }),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
});

test("doctor registration intent creates an active user applicant account", async () => {
  const payload = await registrationPayload("DOCTOR");
  await createOtp(
    emails.doctor,
    "EMAIL_VERIFICATION",
    payload as unknown as Prisma.InputJsonValue,
  );

  const result = await registrationService.verifyRegistration(
    { email: emails.doctor, otp: code },
    meta,
  );
  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: result.user.id },
    include: { patientProfile: true, doctorProfile: true },
  });

  assert.equal(result.user.role, "USER");
  assert.equal(stored.role, "USER");
  assert.equal(stored.patientProfile, null);
  assert.equal(stored.doctorProfile, null);
});
