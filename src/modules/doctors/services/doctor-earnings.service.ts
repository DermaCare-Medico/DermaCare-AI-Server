import {
  AccountStatus,
  AppointmentStatus,
  DoctorApprovalStatus,
  PayoutStatus,
  Prisma,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import type {
  DoctorEarningsHistoryQuery,
  DoctorPayoutListQuery,
} from "../doctors.validation.js";
import {
  calculateConsultationEarnings,
  getEligiblePayment,
  getMonthDateRange,
  isCommittedPayoutStatus,
} from "./doctor-earnings.rules.js";

async function getApprovedDoctor(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      approvalStatus: true,
      user: { select: { id: true, status: true, deletedAt: true } },
    },
  });

  if (
    !doctor ||
    doctor.approvalStatus !== DoctorApprovalStatus.APPROVED ||
    doctor.user.status !== AccountStatus.ACTIVE ||
    doctor.user.deletedAt
  ) {
    throw new AppError("Approved doctor required", HTTP_STATUS.FORBIDDEN);
  }

  return doctor;
}

export async function getDoctorEarningsSummary(userId: string) {
  const doctor = await getApprovedDoctor(userId);

  const completedAppointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: AppointmentStatus.COMPLETED,
    },
    select: {
      id: true,
      status: true,
      payments: {
        where: {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
        },
        select: {
          purpose: true,
          status: true,
          amount: true,
          refundStatus: true,
          refundedAt: true,
        },
      },
      payoutItem: {
        select: {
          id: true,
          payoutId: true,
          payout: { select: { status: true } },
        },
      },
    },
  });

  const eligibleAppointments = completedAppointments.filter((apt) => {
    return getEligiblePayment(apt) !== null;
  });

  let totalGross = new Prisma.Decimal(0);
  let totalPlatformFee = new Prisma.Decimal(0);
  let totalNet = new Prisma.Decimal(0);
  let unpaidBalance = new Prisma.Decimal(0);

  for (const apt of eligibleAppointments) {
    const payment = getEligiblePayment(apt)!;
    const calc = calculateConsultationEarnings(payment.amount);
    totalGross = totalGross.add(calc.consultationAmount);
    totalPlatformFee = totalPlatformFee.add(calc.platformFee);
    totalNet = totalNet.add(calc.doctorAmount);

    if (!apt.payoutItem) {
      unpaidBalance = unpaidBalance.add(calc.doctorAmount);
    }
  }

  const payouts = await prisma.doctorPayout.findMany({
    where: { doctorId: doctor.id },
    select: {
      status: true,
      netAmount: true,
    },
  });

  let totalPaid = new Prisma.Decimal(0);
  let pendingPayout = new Prisma.Decimal(0);

  for (const p of payouts) {
    if (p.status === PayoutStatus.PAID) {
      totalPaid = totalPaid.add(p.netAmount);
    } else if (isCommittedPayoutStatus(p.status)) {
      pendingPayout = pendingPayout.add(p.netAmount);
    }
  }

  return {
    doctorId: doctor.id,
    currency: "BDT",
    totalEarned: totalNet.toFixed(2),
    pendingPayout: pendingPayout.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    unpaidBalance: unpaidBalance.toFixed(2),
    totalConsultations: eligibleAppointments.length,
    breakdown: {
      grossEarnings: totalGross.toFixed(2),
      platformFee: totalPlatformFee.toFixed(2),
      netEarnings: totalNet.toFixed(2),
    },
  };
}

export async function getDoctorEarningsHistory(
  userId: string,
  query: DoctorEarningsHistoryQuery,
) {
  const doctor = await getApprovedDoctor(userId);

  let dateFilter: Prisma.DateTimeFilter | undefined;
  if (query.year && query.month) {
    const range = getMonthDateRange(query.year, query.month);
    dateFilter = {
      gte: range.periodStart,
      lte: range.periodEnd,
    };
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: AppointmentStatus.COMPLETED,
      ...(dateFilter && {
        slot: { startTime: dateFilter },
      }),
    },
    include: {
      patient: {
        select: {
          id: true,
          user: { select: { name: true } },
        },
      },
      slot: {
        select: {
          startTime: true,
          endTime: true,
        },
      },
      payments: {
        where: {
          purpose: TransactionPurpose.APPOINTMENT,
          status: TransactionStatus.PAID,
        },
        select: {
          purpose: true,
          status: true,
          amount: true,
          refundStatus: true,
          refundedAt: true,
        },
      },
      payoutItem: {
        select: {
          id: true,
          payoutId: true,
          consultationAmount: true,
          platformFee: true,
          doctorAmount: true,
          payout: {
            select: {
              status: true,
              paidAt: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const eligible = appointments.filter((apt) => getEligiblePayment(apt) !== null);
  const total = eligible.length;
  const skip = (query.page - 1) * query.limit;
  const paginated = eligible.slice(skip, skip + query.limit);

  const items = paginated.map((apt) => {
    const payment = getEligiblePayment(apt)!;
    const calc = apt.payoutItem
      ? {
          consultationAmount: apt.payoutItem.consultationAmount,
          platformFee: apt.payoutItem.platformFee,
          doctorAmount: apt.payoutItem.doctorAmount,
        }
      : calculateConsultationEarnings(payment.amount);

    return {
      appointmentId: apt.id,
      date: apt.slot?.startTime ?? apt.createdAt,
      patientName: apt.patient.user.name,
      grossAmount: calc.consultationAmount.toFixed(2),
      platformFee: calc.platformFee.toFixed(2),
      netAmount: calc.doctorAmount.toFixed(2),
      payoutStatus: apt.payoutItem ? apt.payoutItem.payout.status : "UNPAID",
      payoutId: apt.payoutItem?.payoutId ?? null,
      paidAt: apt.payoutItem?.payout.paidAt ?? null,
    };
  });

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  };
}

export async function getDoctorPayoutHistory(
  userId: string,
  query: DoctorPayoutListQuery,
) {
  const doctor = await getApprovedDoctor(userId);

  const where: Prisma.DoctorPayoutWhereInput = {
    doctorId: doctor.id,
    ...(query.status && { status: query.status }),
  };

  const [payouts, total] = await prisma.$transaction([
    prisma.doctorPayout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        _count: {
          select: { items: true },
        },
      },
    }),
    prisma.doctorPayout.count({ where }),
  ]);

  return {
    payouts,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit) || 1,
    },
  };
}

