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
import { calculateDashboardFinancials } from "./dashboard.service.js";

const payment = (amount: string, refundStatus: RefundStatus | null = null) => ({
    purpose: TransactionPurpose.APPOINTMENT,
    status: TransactionStatus.PAID,
    amount: new Prisma.Decimal(amount),
    refundStatus,
    refundedAt: null,
});

test("dashboard recognizes completed, paid, non-refunded consultations at the shared 15% rate", () => {
    const result = calculateDashboardFinancials([{
        status: AppointmentStatus.COMPLETED,
        slot: { startTime: new Date("2026-10-10T10:00:00Z") },
        payments: [payment("100")],
        payoutItem: null,
    }], [], [], new Date("2026-10-22T00:00:00Z"));
    assert.equal(result.totalConsultationRevenue, "100.00");
    assert.equal(result.platformCommissionEarned, "15.00");
    assert.equal(result.outstandingDoctorPayouts, "85.00");
    assert.equal(result.monthlyConsultationRevenue, "100.00");
});

test("dashboard excludes cancelled, unpaid and refunded consultations without double counting payout items", () => {
    const result = calculateDashboardFinancials([
        { status: AppointmentStatus.CANCELLED, slot: { startTime: new Date("2026-10-01") }, payments: [payment("100")], payoutItem: null },
        { status: AppointmentStatus.COMPLETED, slot: { startTime: new Date("2026-10-02") }, payments: [], payoutItem: null },
        { status: AppointmentStatus.COMPLETED, slot: { startTime: new Date("2026-10-03") }, payments: [payment("100", RefundStatus.SUCCEEDED)], payoutItem: null },
        { status: AppointmentStatus.COMPLETED, slot: { startTime: new Date("2026-09-30T23:59:59Z") }, payments: [payment("200")], payoutItem: { doctorAmount: new Prisma.Decimal("170"), payout: { status: PayoutStatus.PAID } } },
    ], [new Prisma.Decimal("170")], [new Prisma.Decimal("100")], new Date("2026-10-22"));
    assert.equal(result.totalConsultationRevenue, "200.00");
    assert.equal(result.monthlyConsultationRevenue, "0.00");
    assert.equal(result.doctorPayoutsPaid, "170.00");
    assert.equal(result.outstandingDoctorPayouts, "0.00");
    assert.equal(result.doctorTotalPayable, "170.00");
    assert.equal(result.totalSuccessfulRefunds, "100.00");
});

test("pending and processing ledger items remain outstanding at their frozen ledger amount", () => {
    const appointments = [PayoutStatus.PENDING, PayoutStatus.PROCESSING].map((status, index) => ({
        status: AppointmentStatus.COMPLETED,
        slot: { startTime: new Date(`2026-10-${10 + index}T10:00:00Z`) },
        payments: [payment("100")],
        payoutItem: { doctorAmount: new Prisma.Decimal("85"), payout: { status } },
    }));
    const result = calculateDashboardFinancials(appointments, [], [], new Date("2026-10-22"));
    assert.equal(result.outstandingDoctorPayouts, "170.00");
    assert.equal(result.doctorTotalPayable, "170.00");
});
