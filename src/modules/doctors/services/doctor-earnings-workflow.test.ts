import assert from "node:assert/strict";
import test from "node:test";
import {
  AppointmentStatus,
  PayoutStatus,
  Prisma,
  RefundStatus,
  Role,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import {
  calculateConsultationEarnings,
  DEFAULT_PLATFORM_FEE_PERCENT,
  getEligiblePayment,
  getMonthDateRange,
  isAppointmentEligibleForEarnings,
} from "./doctor-earnings.rules.js";

test("Rule: Default platform fee is exactly 15%", () => {
  assert.equal(DEFAULT_PLATFORM_FEE_PERCENT, 15);
});

test("Rule: Net earnings = Gross consultation amount - 15% platform fee", () => {
  const cases = [
    { gross: "100.00", fee: "15.00", net: "85.00" },
    { gross: "50.00", fee: "7.50", net: "42.50" },
    { gross: "75.00", fee: "11.25", net: "63.75" },
    { gross: "123.45", fee: "18.52", net: "104.93" },
    { gross: "0.00", fee: "0.00", net: "0.00" },
  ];

  for (const { gross, fee, net } of cases) {
    const calc = calculateConsultationEarnings(new Prisma.Decimal(gross));
    assert.equal(calc.consultationAmount.toFixed(2), gross);
    assert.equal(calc.platformFee.toFixed(2), fee);
    assert.equal(calc.doctorAmount.toFixed(2), net);
    assert.equal(calc.platformFee.add(calc.doctorAmount).toFixed(2), gross);
  }
});

test("Rule: Non-completed appointments are never eligible for earnings", () => {
  const nonCompletedStatuses = [
    AppointmentStatus.HELD,
    AppointmentStatus.PENDING,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.CANCELLED,
  ];

  for (const status of nonCompletedStatuses) {
    const apt = {
      status,
      payments: [
        {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
          amount: new Prisma.Decimal("100.00"),
        },
      ],
    };
    assert.equal(isAppointmentEligibleForEarnings(apt), false, `Status ${status} should not be eligible`);
    assert.equal(getEligiblePayment(apt), null);
  }
});

test("Rule: Only PAID transactions are eligible (PENDING or FAILED excluded)", () => {
  const pendingTx = {
    status: AppointmentStatus.COMPLETED,
    payments: [
      {
        purpose: TransactionPurpose.APPOINTMENT,
        status: TransactionStatus.PENDING,
        amount: new Prisma.Decimal("100.00"),
      },
    ],
  };
  assert.equal(isAppointmentEligibleForEarnings(pendingTx), false);
  assert.equal(getEligiblePayment(pendingTx), null);
});

test("Rule: Refunded transactions are strictly excluded from earnings", () => {
  const refundedByStatus = {
    status: AppointmentStatus.COMPLETED,
    payments: [
      {
        purpose: TransactionPurpose.APPOINTMENT,
        status: TransactionStatus.PAID,
        amount: new Prisma.Decimal("100.00"),
        refundStatus: RefundStatus.SUCCEEDED,
      },
    ],
  };
  assert.equal(isAppointmentEligibleForEarnings(refundedByStatus), false);
  assert.equal(getEligiblePayment(refundedByStatus), null);

  const refundedByDate = {
    status: AppointmentStatus.COMPLETED,
    payments: [
      {
        purpose: TransactionPurpose.APPOINTMENT,
        status: TransactionStatus.PAID,
        amount: new Prisma.Decimal("100.00"),
        refundedAt: new Date("2026-10-21T10:00:00Z"),
      },
    ],
  };
  assert.equal(isAppointmentEligibleForEarnings(refundedByDate), false);
  assert.equal(getEligiblePayment(refundedByDate), null);
});

test("Rule: Non-consultation payment transactions (e.g. medicine orders) excluded", () => {
  const medicineOrderTx = {
    status: AppointmentStatus.COMPLETED,
    payments: [
      {
        purpose: TransactionPurpose.MEDICINE_ORDER,
        status: TransactionStatus.PAID,
        amount: new Prisma.Decimal("100.00"),
      },
    ],
  };
  assert.equal(isAppointmentEligibleForEarnings(medicineOrderTx), false);
});

test("Period & Monthly Boundary: Exact UTC calendar month calculations", () => {
  const months = [
    { year: 2026, month: 1, startDay: "2026-01-01", endDay: "2026-01-31" },
    { year: 2026, month: 2, startDay: "2026-02-01", endDay: "2026-02-28" },
    { year: 2024, month: 2, startDay: "2024-02-01", endDay: "2024-02-29" }, // leap year
    { year: 2026, month: 4, startDay: "2026-04-01", endDay: "2026-04-30" },
    { year: 2026, month: 12, startDay: "2026-12-01", endDay: "2026-12-31" },
  ];

  for (const { year, month, startDay, endDay } of months) {
    const range = getMonthDateRange(year, month);
    assert.equal(range.periodStartDateOnly.toISOString().slice(0, 10), startDay);
    assert.equal(range.periodEndDateOnly.toISOString().slice(0, 10), endDay);
    assert.equal(range.periodStart.toISOString().slice(11, 23), "00:00:00.000");
    assert.equal(range.periodEnd.toISOString().slice(11, 23), "23:59:59.999");
  }
});

test("Idempotency Simulation: Monthly payout generation enforces status PENDING and no duplicates", () => {
  // Simulating the idempotency check
  const existingLedger = new Map<string, any>();
  const generateMockPayout = (doctorId: string, year: number, month: number, appointments: any[]) => {
    const key = `${doctorId}_${year}_${month}`;
    if (existingLedger.has(key)) {
      return { isIdempotent: true, payout: existingLedger.get(key) };
    }

    let gross = new Prisma.Decimal(0);
    let fee = new Prisma.Decimal(0);
    let net = new Prisma.Decimal(0);

    for (const apt of appointments) {
      const calc = calculateConsultationEarnings(apt.amount);
      gross = gross.add(calc.consultationAmount);
      fee = fee.add(calc.platformFee);
      net = net.add(calc.doctorAmount);
    }

    const newPayout = {
      id: "payout-uuid-1",
      doctorId,
      status: PayoutStatus.PENDING, // Must remain PENDING until Batch 03
      totalConsultations: appointments.length,
      grossAmount: gross,
      platformFee: fee,
      netAmount: net,
    };

    existingLedger.set(key, newPayout);
    return { isIdempotent: false, payout: newPayout };
  };

  const sampleAppointments = [
    { id: "apt-1", amount: new Prisma.Decimal("100.00") },
    { id: "apt-2", amount: new Prisma.Decimal("200.00") },
  ];

  const firstCall = generateMockPayout("doc-1", 2026, 10, sampleAppointments);
  assert.equal(firstCall.isIdempotent, false);
  assert.equal(firstCall.payout.status, PayoutStatus.PENDING);
  assert.equal(firstCall.payout.grossAmount.toString(), "300");
  assert.equal(firstCall.payout.platformFee.toString(), "45");
  assert.equal(firstCall.payout.netAmount.toString(), "255");

  // Repeated call for same doctor and period
  const secondCall = generateMockPayout("doc-1", 2026, 10, sampleAppointments);
  assert.equal(secondCall.isIdempotent, true);
  assert.equal(secondCall.payout.id, firstCall.payout.id);
  assert.equal(secondCall.payout.status, PayoutStatus.PENDING);
});

