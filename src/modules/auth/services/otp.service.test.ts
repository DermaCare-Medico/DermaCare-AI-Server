import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import { env } from "../../../config/env.js";
import type { OtpPurpose, Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { otpService } from "./otp.service.js";

const email = "otp-transaction-test@example.test";
const purpose: OtpPurpose = "EMAIL_VERIFICATION";
const code = "123456";

const codeHash = crypto
  .createHmac("sha256", env.OTP_SECRET)
  .update(`${email}:${purpose}:${code}`)
  .digest("hex");

const makeOtpState = (expiresAt = new Date(Date.now() + 60_000)) => ({
  id: "00000000-0000-0000-0000-000000000001",
  email,
  purpose,
  codeHash,
  expiresAt,
  attempts: 0,
  usedAt: null as Date | null,
  createdAt: new Date(),
  payload: { role: "PATIENT" },
});

const makeClient = (record: ReturnType<typeof makeOtpState>) => ({
  otpCode: {
    findFirst: async () => record.usedAt ? null : { ...record },
    update: async () => ({ attempts: ++record.attempts }),
    updateMany: async () => {
      if (record.usedAt) return { count: 0 };
      record.usedAt = new Date();
      return { count: 1 };
    },
  },
} as unknown as Prisma.TransactionClient);

test("successful verification consumes the OTP once", async () => {
  const record = makeOtpState();
  await otpService.verify({ email, purpose, code, consume: true }, makeClient(record));
  assert.ok(record.usedAt);
});

test("a failed transaction can roll OTP consumption back", async () => {
  const record = makeOtpState();
  const before = record.usedAt;

  await assert.rejects(async () => {
    try {
      await otpService.verify({ email, purpose, code, consume: true }, makeClient(record));
      throw new Error("associated mutation failed");
    } catch (error) {
      record.usedAt = before;
      throw error;
    }
  }, /associated mutation failed/);

  assert.equal(record.usedAt, null);
});

test("expired OTP is rejected without consumption", async () => {
  const record = makeOtpState(new Date(Date.now() - 1));
  await assert.rejects(
    otpService.verify({ email, purpose, code, consume: true }, makeClient(record)),
    (error: unknown) => error instanceof AppError && error.statusCode === 400,
  );
  assert.equal(record.usedAt, null);
});

test("concurrent verification has exactly one successful consumer", async () => {
  const record = makeOtpState();
  let reads = 0;
  let releaseReads!: () => void;
  const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
  const client = makeClient(record) as unknown as {
    otpCode: {
      findFirst: () => Promise<typeof record>;
      update: () => Promise<{ attempts: number }>;
      updateMany: () => Promise<{ count: number }>;
    };
  };
  const baseFindFirst = client.otpCode.findFirst;
  client.otpCode.findFirst = async () => {
    const snapshot = await baseFindFirst();
    reads += 1;
    if (reads === 2) releaseReads();
    await bothRead;
    return snapshot;
  };

  const results = await Promise.allSettled([
    otpService.verify({ email, purpose, code, consume: true }, client as unknown as Prisma.TransactionClient),
    otpService.verify({ email, purpose, code, consume: true }, client as unknown as Prisma.TransactionClient),
  ]);

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
});
