import assert from "node:assert/strict";
import test from "node:test";
import {
  AppointmentStatus,
  PayoutStatus,
  Prisma,
  RefundStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { aggregateDoctorEarnings, findLedgerMismatches, formatDoctorEarningsAggregate } from "./doctor-earnings-aggregation.service.js";

const payment = (amount: string, status: TransactionStatus = TransactionStatus.PAID, refundStatus: RefundStatus | null = null) => ({
  purpose: TransactionPurpose.APPOINTMENT,
  status,
  amount: new Prisma.Decimal(amount),
  refundStatus,
  refundedAt: null,
});

test("BDT 1,500 produces 225 commission and 1,275 doctor share", () => {
  const result = aggregateDoctorEarnings([{
    status: AppointmentStatus.COMPLETED,
    payments: [payment("1500.00")],
    payoutItem: null,
  }]);
  assert.deepEqual(formatDoctorEarningsAggregate(result), {
    eligibleConsultations: 1,
    grossAmount: "1500.00",
    platformFee: "225.00",
    netAmount: "1275.00",
    paidAmount: "0.00",
    pendingCommittedAmount: "0.00",
    unallocatedAmount: "1275.00",
  });
});

test("paid and pending ledger items are separated from unallocated earnings", () => {
  const result = aggregateDoctorEarnings([
    {
      status: AppointmentStatus.COMPLETED,
      payments: [payment("100.00")],
      payoutItem: { doctorAmount: new Prisma.Decimal("85.00"), payout: { status: PayoutStatus.PAID } },
    },
    {
      status: AppointmentStatus.COMPLETED,
      payments: [payment("200.00")],
      payoutItem: { doctorAmount: new Prisma.Decimal("170.00"), payout: { status: PayoutStatus.PENDING } },
    },
    {
      status: AppointmentStatus.COMPLETED,
      payments: [payment("300.00")],
      payoutItem: null,
    },
  ]);
  assert.equal(result.paidAmount.toFixed(2), "85.00");
  assert.equal(result.pendingCommittedAmount.toFixed(2), "170.00");
  assert.equal(result.unallocatedAmount.toFixed(2), "255.00");
});

test("refunded, incomplete, and unpaid appointments are excluded", () => {
  const result = aggregateDoctorEarnings([
    { status: AppointmentStatus.COMPLETED, payments: [payment("100.00", TransactionStatus.PAID, RefundStatus.SUCCEEDED)], payoutItem: null },
    { status: AppointmentStatus.CONFIRMED, payments: [payment("100.00")], payoutItem: null },
    { status: AppointmentStatus.COMPLETED, payments: [payment("100.00", TransactionStatus.PENDING)], payoutItem: null },
  ]);
  assert.equal(result.eligibleConsultations, 0);
});

test("a pending transaction does not hide a separately verified paid transaction", () => {
  const result = aggregateDoctorEarnings([{
    status: AppointmentStatus.COMPLETED,
    payments: [payment("100.00", TransactionStatus.PENDING), payment("100.00")],
    payoutItem: null,
  }]);
  assert.equal(result.eligibleConsultations, 1);
  assert.equal(result.grossAmount.toFixed(2), "100.00");
});

test("two-decimal half-up rounding is consistent", () => {
  const result = aggregateDoctorEarnings([{
    status: AppointmentStatus.COMPLETED,
    payments: [payment("75.50")],
    payoutItem: null,
  }]);
  assert.equal(result.platformFee.toFixed(2), "11.33");
  assert.equal(result.netAmount.toFixed(2), "64.17");
});

test("historical ledger mismatches are reported without changing the ledger", () => {
  const appointment = {
    id: "appointment-1",
    status: AppointmentStatus.COMPLETED,
    payments: [payment("1500.00")],
    payoutItem: {
      payoutId: "payout-1",
      consultationAmount: new Prisma.Decimal("1500.00"),
      platformFee: new Prisma.Decimal("150.00"),
      doctorAmount: new Prisma.Decimal("1350.00"),
      payout: { status: PayoutStatus.PENDING },
    },
  };
  const mismatches = findLedgerMismatches([appointment]);
  assert.equal(mismatches.length, 1);
  assert.equal(mismatches[0]!.expectedPlatformFee, "225.00");
  assert.equal(appointment.payoutItem.platformFee.toFixed(2), "150.00");
});
