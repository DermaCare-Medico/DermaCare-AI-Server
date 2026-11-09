import { AppointmentStatus, PayoutStatus, Prisma, RefundStatus, TransactionPurpose, TransactionStatus } from "../../../generated/prisma/client.js";
import { calculateConsultationEarnings, getEligiblePayment, type PaymentRecord } from "./doctor-earnings.rules.js";

export type EarningsAppointment = {
  id?: string;
  status: AppointmentStatus;
  payments: PaymentRecord[];
  payoutItem?: {
    id?: string;
    payoutId?: string;
    consultationAmount?: Prisma.Decimal;
    platformFee?: Prisma.Decimal;
    doctorAmount?: Prisma.Decimal;
    payout: { status: PayoutStatus; paidAt?: Date | null };
  } | null;
};

export type DoctorEarningsAggregate = {
  eligibleConsultations: number;
  grossAmount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  paidAmount: Prisma.Decimal;
  pendingCommittedAmount: Prisma.Decimal;
  unallocatedAmount: Prisma.Decimal;
};

export type LedgerMismatch = {
  appointmentId: string;
  payoutId: string | null;
  expectedGross: string;
  ledgerGross: string;
  expectedPlatformFee: string;
  ledgerPlatformFee: string;
  expectedDoctorAmount: string;
  ledgerDoctorAmount: string;
};

const zero = () => new Prisma.Decimal(0);

export const aggregateDoctorEarnings = (appointments: EarningsAppointment[]): DoctorEarningsAggregate => {
  const result: DoctorEarningsAggregate = {
    eligibleConsultations: 0,
    grossAmount: zero(),
    platformFee: zero(),
    netAmount: zero(),
    paidAmount: zero(),
    pendingCommittedAmount: zero(),
    unallocatedAmount: zero(),
  };

  for (const appointment of appointments) {
    const payment = getEligiblePayment(appointment);
    if (!payment) continue;
    const calculated = calculateConsultationEarnings(payment.amount);
    result.eligibleConsultations += 1;
    result.grossAmount = result.grossAmount.add(calculated.consultationAmount);
    result.platformFee = result.platformFee.add(calculated.platformFee);
    result.netAmount = result.netAmount.add(calculated.doctorAmount);

    const item = appointment.payoutItem;
    const doctorAmount = item?.doctorAmount ?? calculated.doctorAmount;
    if (!item) {
      result.unallocatedAmount = result.unallocatedAmount.add(doctorAmount);
    } else if (item.payout.status === PayoutStatus.PAID) {
      result.paidAmount = result.paidAmount.add(doctorAmount);
    } else if (item.payout.status === PayoutStatus.PENDING || item.payout.status === PayoutStatus.PROCESSING) {
      result.pendingCommittedAmount = result.pendingCommittedAmount.add(doctorAmount);
    }
  }
  return result;
};

export const formatDoctorEarningsAggregate = (aggregate: DoctorEarningsAggregate) => ({
  eligibleConsultations: aggregate.eligibleConsultations,
  grossAmount: aggregate.grossAmount.toFixed(2),
  platformFee: aggregate.platformFee.toFixed(2),
  netAmount: aggregate.netAmount.toFixed(2),
  paidAmount: aggregate.paidAmount.toFixed(2),
  pendingCommittedAmount: aggregate.pendingCommittedAmount.toFixed(2),
  unallocatedAmount: aggregate.unallocatedAmount.toFixed(2),
});

export const findLedgerMismatches = (appointments: EarningsAppointment[]): LedgerMismatch[] => appointments.flatMap((appointment) => {
  const payment = getEligiblePayment(appointment);
  const item = appointment.payoutItem;
  if (!payment || !item || item.consultationAmount == null || item.platformFee == null || item.doctorAmount == null) return [];
  const expected = calculateConsultationEarnings(payment.amount);
  if (expected.consultationAmount.equals(item.consultationAmount)
    && expected.platformFee.equals(item.platformFee)
    && expected.doctorAmount.equals(item.doctorAmount)) return [];
  return [{
    appointmentId: appointment.id ?? "unknown",
    payoutId: item.payoutId ?? null,
    expectedGross: expected.consultationAmount.toFixed(2),
    ledgerGross: item.consultationAmount.toFixed(2),
    expectedPlatformFee: expected.platformFee.toFixed(2),
    ledgerPlatformFee: item.platformFee.toFixed(2),
    expectedDoctorAmount: expected.doctorAmount.toFixed(2),
    ledgerDoctorAmount: item.doctorAmount.toFixed(2),
  }];
});

export const isVerifiedAppointmentPayment = (payment: PaymentRecord) =>
  payment.purpose === TransactionPurpose.APPOINTMENT
  && payment.status === TransactionStatus.PAID
  && payment.refundStatus !== RefundStatus.SUCCEEDED
  && payment.refundedAt == null;
