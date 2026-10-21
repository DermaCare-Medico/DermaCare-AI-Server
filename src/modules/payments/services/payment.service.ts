import { randomUUID } from "node:crypto";

import {
    AccountStatus,
    AppointmentStatus,
    DoctorApprovalStatus,
    OrderStatus,
    Prisma,
    Role,
    TransactionPurpose,
    TransactionStatus,
    SlotStatus,
    MeetingProvisioningStatus,
    NotificationType,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { OrderPaymentInput } from "../payments.validation.js";
import {
    isMatchingOrderPayment,
    isOrderPaymentExpired,
} from "../../orders/services/order-payment.rules.js";
import { requestMeetingProvisioning } from "../../../integrations/google-calendar/meeting-provisioning.worker.js";
import { createNotification } from "../../notifications/services/notification.service.js";
import { env } from "../../../config/env.js";

const ensureDemoPaymentsAllowed = () => {
    if (env.NODE_ENV === "production" || !env.ALLOW_DEMO_PAYMENTS) {
        throw new AppError(
            "Demo payments are disabled in this environment. Use Stripe checkout.",
            HTTP_STATUS.FORBIDDEN,
        );
    }
};

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
    ensureDemoPaymentsAllowed();
    const patient = await getActivePatient(userId);

    try {
        const result = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.findFirst({
                where: {
                    id: appointmentId,
                    patientId: patient.id,
                },
                select: {
                    id: true,
                    status: true,
                    slotId: true,
                    doctorId: true,
                    holdExpiresAt: true,
                    doctor: {
                        select: {
                            userId: true,
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

            if (appointment.holdExpiresAt && appointment.holdExpiresAt <= new Date()) {
                throw new AppError(
                    "Appointment payment window has expired",
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
                    meetingProvisioningStatus: MeetingProvisioningStatus.PENDING,
                    meetingProvisioningNextAttemptAt: new Date(),
                    meetingProvisioningError: null,
                },
            });

            if (confirmed.count !== 1) {
                throw new AppError(
                    "Appointment payment is already being processed",
                    HTTP_STATUS.CONFLICT,
                );
            }

            await tx.doctorSlot.updateMany({
                where: {
                    id: appointment.slotId,
                    doctorId: appointment.doctorId,
                    status: SlotStatus.HELD,
                },
                data: { status: SlotStatus.BOOKED },
            });

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

            await createNotification({
                userId,
                title: "Appointment payment successful",
                message: "Your appointment payment was successful and the appointment is confirmed.",
                notificationType: NotificationType.PAYMENT,
                relatedEntityType: "Appointment",
                relatedEntityId: appointment.id,
            }, tx);
            await createNotification({
                userId: appointment.doctor.userId,
                title: "Appointment confirmed",
                message: "An appointment has been confirmed after successful payment.",
                notificationType: NotificationType.APPOINTMENT,
                relatedEntityType: "Appointment",
                relatedEntityId: appointment.id,
            }, tx);

            return {
                ...payment,
                appointmentStatus: AppointmentStatus.CONFIRMED,
            };
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
        requestMeetingProvisioning();
        return result;
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
                    refundStatus: true,
                    refundedAt: true,
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

const payForOrder = async (
    userId: string,
    orderId: string,
    input: OrderPaymentInput,
) => {
    ensureDemoPaymentsAllowed();
    const patient = await getActivePatient(userId);

    try {
        return await prisma.$transaction(async (tx) => {
            const order = await tx.order.findFirst({
                where: { id: orderId, patientId: patient.id },
                select: {
                    id: true,
                    status: true,
                    totalAmount: true,
                    paymentExpiresAt: true,
                    payments: {
                        where: {
                            purpose: TransactionPurpose.MEDICINE_ORDER,
                            status: TransactionStatus.PAID,
                        },
                        select: { id: true },
                        take: 1,
                    },
                },
            });
            if (!order) throw new AppError("Order not found", HTTP_STATUS.NOT_FOUND);
            if (order.payments.length > 0) {
                throw new AppError("Order has already been paid", HTTP_STATUS.CONFLICT);
            }
            if (order.status !== OrderStatus.PENDING) {
                throw new AppError("Order is not awaiting payment", HTTP_STATUS.CONFLICT);
            }
            if (isOrderPaymentExpired(order.paymentExpiresAt)) {
                throw new AppError("Order payment has expired", HTTP_STATUS.CONFLICT);
            }
            const submittedAmount = new Prisma.Decimal(input.amount);
            if (!isMatchingOrderPayment(order.totalAmount, submittedAmount, input.currency)) {
                throw new AppError("Payment amount or currency does not match the order", 400);
            }

            const confirmed = await tx.order.updateMany({
                where: {
                    id: order.id,
                    patientId: patient.id,
                    status: OrderStatus.PENDING,
                    paymentExpiresAt: { gt: new Date() },
                    payments: {
                        none: {
                            purpose: TransactionPurpose.MEDICINE_ORDER,
                            status: TransactionStatus.PAID,
                        },
                    },
                },
                data: { status: OrderStatus.CONFIRMED },
            });
            if (confirmed.count !== 1) {
                throw new AppError("Order payment is already being processed or expired", 409);
            }

            const paidAt = new Date();
            const payment = await tx.paymentTransaction.create({
                data: {
                    patientId: patient.id,
                    orderId: order.id,
                    purpose: TransactionPurpose.MEDICINE_ORDER,
                    amount: order.totalAmount,
                    currency: input.currency,
                    status: TransactionStatus.PAID,
                    provider: "DEMO",
                    providerTransactionId: `demo_${randomUUID()}`,
                    paidAt,
                },
                select: {
                    id: true,
                    orderId: true,
                    amount: true,
                    currency: true,
                    status: true,
                    provider: true,
                    providerTransactionId: true,
                    paidAt: true,
                    createdAt: true,
                },
            });
            await createNotification({
                userId,
                title: "Order payment successful",
                message: "Your medicine order payment was successful and the order is confirmed.",
                notificationType: NotificationType.PAYMENT,
                relatedEntityType: "Order",
                relatedEntityId: order.id,
            }, tx);
            return { ...payment, orderStatus: OrderStatus.CONFIRMED };
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError
            && (error.code === "P2002" || error.code === "P2034")) {
            throw new AppError("Order payment is already being processed", 409);
        }
        throw error;
    }
};

const getOrderPayment = async (userId: string, orderId: string) => {
    const patient = await getActivePatient(userId);
    const order = await prisma.order.findFirst({
        where: { id: orderId, patientId: patient.id },
        select: {
            id: true,
            status: true,
            totalAmount: true,
            paymentExpiresAt: true,
            payments: {
                where: { purpose: TransactionPurpose.MEDICINE_ORDER },
                orderBy: { createdAt: "desc" },
                take: 1,
                select: {
                    id: true,
                    status: true,
                    amount: true,
                    currency: true,
                    provider: true,
                    paidAt: true,
                    refundStatus: true,
                    refundedAt: true,
                    createdAt: true,
                },
            },
        },
    });
    if (!order) throw new AppError("Order not found", HTTP_STATUS.NOT_FOUND);
    const payment = order.payments[0] ?? null;
    return {
        orderId: order.id,
        orderStatus: order.status,
        totalAmount: order.totalAmount,
        paymentExpiresAt: order.paymentExpiresAt,
        isExpired: order.status === OrderStatus.PENDING
            && isOrderPaymentExpired(order.paymentExpiresAt),
        isPaid: payment?.status === TransactionStatus.PAID,
        payment,
    };
};

export const paymentService = {
    payForAppointment,
    getAppointmentPayment,
    payForOrder,
    getOrderPayment,
};
