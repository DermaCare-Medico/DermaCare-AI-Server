import { randomUUID } from "node:crypto";

import {
    AccountStatus,
    AppointmentStatus,
    DoctorApprovalStatus,
    Prisma,
    Role,
    TransactionPurpose,
    TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";

const getActivePatient = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.PATIENT,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: {
            patientProfile: {
                select: { id: true },
            },
        },
    });

    if (!user) {
        throw new AppError(
            "Only active patients may make appointment payments",
            HTTP_STATUS.FORBIDDEN,
        );
    }
    if (!user.patientProfile) {
        throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    }

    return user.patientProfile;
};

const payForAppointment = async (userId: string, appointmentId: string) => {
    const patient = await getActivePatient(userId);

    try {
        return await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.findFirst({
                where: {
                    id: appointmentId,
                    patientId: patient.id,
                },
                select: {
                    id: true,
                    status: true,
                    doctor: {
                        select: {
                            approvalStatus: true,
                            consultationFee: true,
                        },
                    },
                },
            });

            if (!appointment) {
                throw new AppError("Appointment not found", HTTP_STATUS.NOT_FOUND);
            }

            const existingPayment = await tx.paymentTransaction.findFirst({
                where: {
                    appointmentId: appointment.id,
                    purpose: TransactionPurpose.APPOINTMENT,
                    status: TransactionStatus.PAID,
                },
                select: { id: true },
            });

            if (existingPayment) {
                throw new AppError(
                    "Appointment has already been paid",
                    HTTP_STATUS.CONFLICT,
                );
            }

            if (appointment.doctor.approvalStatus !== DoctorApprovalStatus.APPROVED
                || appointment.status !== AppointmentStatus.PENDING) {
                throw new AppError(
                    "Appointment is not approved for payment",
                    HTTP_STATUS.CONFLICT,
                );
            }

            const confirmed = await tx.appointment.updateMany({
                where: {
                    id: appointment.id,
                    patientId: patient.id,
                    status: AppointmentStatus.PENDING,
                    payments: {
                        none: {
                            purpose: TransactionPurpose.APPOINTMENT,
                            status: TransactionStatus.PAID,
                        },
                    },
                },
                data: {
                    status: AppointmentStatus.CONFIRMED,
                },
            });

            if (confirmed.count !== 1) {
                throw new AppError(
                    "Appointment payment is already being processed",
                    HTTP_STATUS.CONFLICT,
                );
            }

            const paidAt = new Date();
            const payment = await tx.paymentTransaction.create({
                data: {
                    patientId: patient.id,
                    appointmentId: appointment.id,
                    purpose: TransactionPurpose.APPOINTMENT,
                    amount: appointment.doctor.consultationFee,
                    currency: "BDT",
                    status: TransactionStatus.PAID,
                    provider: "DEMO",
                    providerTransactionId: `demo_${randomUUID()}`,
                    paidAt,
                },
                select: {
                    id: true,
                    appointmentId: true,
                    amount: true,
                    currency: true,
                    status: true,
                    provider: true,
                    providerTransactionId: true,
                    paidAt: true,
                    createdAt: true,
                },
            });

            return {
                ...payment,
                appointmentStatus: AppointmentStatus.CONFIRMED,
            };
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError
            && (error.code === "P2002" || error.code === "P2034")) {
            throw new AppError(
                "Appointment payment is already being processed",
                HTTP_STATUS.CONFLICT,
            );
        }

        throw error;
    }
};

const getAppointmentPayment = async (userId: string, appointmentId: string) => {
    const patient = await getActivePatient(userId);
    const appointment = await prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            patientId: patient.id,
        },
        select: {
            id: true,
            payments: {
                where: {
                    purpose: TransactionPurpose.APPOINTMENT,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    amount: true,
                    currency: true,
                    paidAt: true,
                },
            },
        },
    });

    if (!appointment) {
        throw new AppError("Appointment not found", HTTP_STATUS.NOT_FOUND);
    }

    const payment = appointment.payments[0] ?? null;

    return {
        appointmentId: appointment.id,
        isPaid: payment?.status === TransactionStatus.PAID,
        payment,
    };
};

export const paymentService = {
    payForAppointment,
    getAppointmentPayment,
};
