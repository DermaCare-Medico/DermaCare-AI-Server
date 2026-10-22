import assert from "node:assert/strict";
import test from "node:test";
import {
  AppointmentStatus,
  Prisma,
  RefundStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import {
  calculateConsultationEarnings,
  getMonthDateRange,
  isAppointmentEligibleForEarnings,
  isCommittedPayoutStatus,
  slotStartInEarningsRange,
} from "./doctor-earnings.rules.js";

test("calculateConsultationEarnings correctly computes 15% default platform commission", () => {
  const result = calculateConsultationEarnings(100);
  assert.equal(result.consultationAmount.toString(), "100");
  assert.equal(result.platformFee.toString(), "15");
  assert.equal(result.doctorAmount.toString(), "85");
  assert.equal(result.platformFee.add(result.doctorAmount).toString(), "100");
});

test("PROCESSING and PENDING payouts are committed allocations", () => {
  assert.equal(isCommittedPayoutStatus("PENDING"), true);
  assert.equal(isCommittedPayoutStatus("PROCESSING"), true);
  assert.equal(isCommittedPayoutStatus("PAID"), false);
  assert.equal(isCommittedPayoutStatus("FAILED"), false);
});

test("monthly earnings use only appointment slot start time at UTC boundaries", () => {
  const range = getMonthDateRange(2026, 10);
  const where = slotStartInEarningsRange(range);
  assert.deepEqual(where, { slot: { startTime: { gte: range.periodStart, lte: range.periodEnd } } });
  assert.equal("createdAt" in where, false);
});

test("calculateConsultationEarnings handles fractional numbers and rounds half up", () => {
  // 75.50 * 0.15 = 11.325 -> 11.33
  const result = calculateConsultationEarnings(new Prisma.Decimal("75.50"));
  assert.equal(result.consultationAmount.toString(), "75.5");
  assert.equal(result.platformFee.toString(), "11.33");
  assert.equal(result.doctorAmount.toString(), "64.17");
  assert.equal(result.platformFee.add(result.doctorAmount).toString(), "75.5");
});

test("calculateConsultationEarnings supports custom commission percentage", () => {
  const result = calculateConsultationEarnings(200, 20);
  assert.equal(result.consultationAmount.toString(), "200");
  assert.equal(result.platformFee.toString(), "40");
  assert.equal(result.doctorAmount.toString(), "160");
});

test("getMonthDateRange handles month boundaries correctly including leap years", () => {
  const oct = getMonthDateRange(2026, 10);
  assert.equal(oct.periodStartDateOnly.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(oct.periodEndDateOnly.toISOString().slice(0, 10), "2026-10-31");
  assert.equal(oct.periodStart.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(oct.periodEnd.toISOString(), "2026-10-31T23:59:59.999Z");

  const febLeap = getMonthDateRange(2024, 2);
  assert.equal(febLeap.periodStartDateOnly.toISOString().slice(0, 10), "2024-02-01");
  assert.equal(febLeap.periodEndDateOnly.toISOString().slice(0, 10), "2024-02-29");

  const febNonLeap = getMonthDateRange(2025, 2);
  assert.equal(febNonLeap.periodStartDateOnly.toISOString().slice(0, 10), "2025-02-01");
  assert.equal(febNonLeap.periodEndDateOnly.toISOString().slice(0, 10), "2025-02-28");
});

test("isAppointmentEligibleForEarnings only accepts COMPLETED with verified PAID transaction", () => {
  const validCompleted = {
    status: AppointmentStatus.COMPLETED,
    payments: [
      {
        purpose: TransactionPurpose.APPOINTMENT,
        status: TransactionStatus.PAID,
        amount: new Prisma.Decimal("100.00"),
      },
    ],
  };
  assert.equal(isAppointmentEligibleForEarnings(validCompleted), true);

  // Non-completed
  assert.equal(
    isAppointmentEligibleForEarnings({
      ...validCompleted,
      status: AppointmentStatus.CONFIRMED,
    }),
    false,
  );
  assert.equal(
    isAppointmentEligibleForEarnings({
      ...validCompleted,
      status: AppointmentStatus.HELD,
    }),
    false,
  );

  // Payment not paid
  assert.equal(
    isAppointmentEligibleForEarnings({
      status: AppointmentStatus.COMPLETED,
      payments: [
        {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PENDING,
          amount: new Prisma.Decimal("100.00"),
        },
      ],
    }),
    false,
  );

  // Payment is for ORDER, not APPOINTMENT
  assert.equal(
    isAppointmentEligibleForEarnings({
      status: AppointmentStatus.COMPLETED,
      payments: [
        {
          purpose: TransactionPurpose.MEDICINE_ORDER,
          status: TransactionStatus.PAID,
          amount: new Prisma.Decimal("100.00"),
        },
      ],
    }),
    false,
  );
});

test("isAppointmentEligibleForEarnings excludes refunded consultations", () => {
  assert.equal(
    isAppointmentEligibleForEarnings({
      status: AppointmentStatus.COMPLETED,
      payments: [
        {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
          amount: new Prisma.Decimal("100.00"),
          refundStatus: RefundStatus.SUCCEEDED,
        },
      ],
    }),
    false,
  );

  assert.equal(
    isAppointmentEligibleForEarnings({
      status: AppointmentStatus.COMPLETED,
      payments: [
        {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
          amount: new Prisma.Decimal("100.00"),
          refundedAt: new Date("2026-10-20T12:00:00Z"),
        },
      ],
    }),
    false,
  );
});
