

import {
  AppointmentStatus,
  Prisma,
  RefundStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";

export const DEFAULT_PLATFORM_FEE_PERCENT = 15;

export interface ConsultationEarningsCalculation {
  consultationAmount: Prisma.Decimal;
  platformFee: Prisma.Decimal;
  doctorAmount: Prisma.Decimal;
}

export function calculateConsultationEarnings(
  consultationAmount: Prisma.Decimal | number | string,
  feePercent: number = DEFAULT_PLATFORM_FEE_PERCENT,
): ConsultationEarningsCalculation {
  const amount = new Prisma.Decimal(consultationAmount);
  if (amount.lessThan(0)) {
    throw new Error("Consultation amount cannot be negative");
  }
  const feeRate = new Prisma.Decimal(feePercent).dividedBy(100);
  const platformFee = amount.mul(feeRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const doctorAmount = amount.sub(platformFee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return {
    consultationAmount: amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
    platformFee,
    doctorAmount,
  };
}

export function getMonthDateRange(year: number, month: number) {
  if (month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12");
  }
  // Month is 1-indexed (1 = Jan, 12 = Dec)
  const periodStartDateOnly = new Date(Date.UTC(year, month - 1, 1));
  const periodEndDateOnly = new Date(Date.UTC(year, month, 0));

  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    periodStart,
    periodEnd,
    nextMonthStart,
    periodStartDateOnly,
    periodEndDateOnly,
  };
}

export interface PaymentRecord {
  purpose: TransactionPurpose;
  status: TransactionStatus;
  amount: Prisma.Decimal;
  refundStatus?: RefundStatus | null;
  refundedAt?: Date | null;
}

export interface AppointmentRecordForEarnings {
  status: AppointmentStatus;
  payments: PaymentRecord[];
}

export function getEligiblePayment(appointment: AppointmentRecordForEarnings): PaymentRecord | null {
  if (appointment.status !== AppointmentStatus.COMPLETED) {
    return null;
  }

  const paidTx = appointment.payments.find(
    (p) => p.purpose === TransactionPurpose.APPOINTMENT && p.status === TransactionStatus.PAID,
  );

  if (!paidTx) {
    return null;
  }

  // Exclude refunded
  if (paidTx.refundStatus === RefundStatus.SUCCEEDED || paidTx.refundedAt != null) {
    return null;
  }

  return paidTx;
}

export function isAppointmentEligibleForEarnings(appointment: AppointmentRecordForEarnings): boolean {
  return getEligiblePayment(appointment) !== null;
}
