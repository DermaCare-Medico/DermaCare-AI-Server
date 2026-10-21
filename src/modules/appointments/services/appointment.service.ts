import {
    AccountStatus,
    AppointmentStatus,
    DoctorApprovalStatus,
    NotificationType,
    Prisma,
    Role,
    SlotStatus,
    TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { createNotification } from "../../notifications/services/notification.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type {
    AppointmentListQuery,
    CreateAppointmentInput,
} from "../appointments.validation.js";
import type { AdminAppointmentListQuery } from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";
import { canExposeMeeting } from "../../../integrations/google-calendar/meeting-access.rules.js";
import { presentDoctorSpecializations } from "../../doctors/doctor-specializations.presenter.js";

const httpError = (statusCode: number, message: string) => new AppError(message, statusCode);

const getActivePatient = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.PATIENT,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { patientProfile: { select: { id: true } } },
    });

    if (!user) throw httpError(403, "Only active patients may access appointments");
    if (!user.patientProfile) throw httpError(404, "Patient profile not found");
    return user.patientProfile;
};

const appointmentSelect = {
    id: true,
    status: true,
    screeningId: true,
    historySharingConsent: true,
    videoLink: true,
    meetingProvisioningStatus: true,
    cancellationReason: true,
    holdExpiresAt: true,
    createdAt: true,
    updatedAt: true,
    doctor: {
        select: {
            id: true,
            consultationFee: true,
            bio: true,
            qualifications: true,
            experienceYears: true,
            rating: true,
            ratingCount: true,
            user: { select: { name: true } },
            specializations: {
                select: {
                    specialization: { select: { id: true, name: true } },
                },
            },
        },
    },
    slot: { select: { id: true, startTime: true, endTime: true } },
    screening: {
        select: {
            id: true,
            symptoms: true,
            riskLevel: true,
            redFlagDetected: true,
            aiStatus: true,
            createdAt: true,
        },
    },
    prescription: { select: { sentAt: true } },
    payments: {
        where: { purpose: "APPOINTMENT" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { status: true },
    },
} satisfies Prisma.AppointmentSelect;

type SelectedAppointment = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;

const presentAppointment = (appointment: SelectedAppointment, includeDetails = false) => {
    const paymentStatus = appointment.payments[0]?.status ?? null;
    const canViewConsultation = canExposeMeeting(appointment.status, paymentStatus);

    return {
        id: appointment.id,
        status: appointment.status,
        doctor: {
            id: appointment.doctor.id,
            name: appointment.doctor.user.name,
            ...presentDoctorSpecializations(appointment.doctor.specializations),
            consultationFee: appointment.doctor.consultationFee,
            ...(includeDetails && {
                bio: appointment.doctor.bio,
                qualifications: appointment.doctor.qualifications,
                experienceYears: appointment.doctor.experienceYears,
                rating: appointment.doctor.rating,
                ratingCount: appointment.doctor.ratingCount,
            }),
        },
        slot: appointment.slot,
        paymentStatus,
        prescriptionSent: appointment.prescription?.sentAt != null,
        videoLink: canViewConsultation ? appointment.videoLink : null,
        meetingProvisioningStatus: canViewConsultation
            ? appointment.meetingProvisioningStatus
            : "NOT_REQUESTED",
        ...(includeDetails && {
            screening: appointment.screening,
            historySharingConsent: appointment.historySharingConsent,
            cancellationReason: appointment.cancellationReason,
            holdExpiresAt: appointment.holdExpiresAt,
            updatedAt: appointment.updatedAt,
        }),
        createdAt: appointment.createdAt,
    };
};

const createAppointment = async (
    userId: string,
    payload: CreateAppointmentInput,
) => {
    const patient = await getActivePatient(userId);

    try {
        const appointment = await prisma.$transaction(async (tx) => {
            const doctor = await tx.doctorProfile.findFirst({
                where: {
                    id: payload.doctorId,
                    approvalStatus: DoctorApprovalStatus.APPROVED,
                    user: { status: AccountStatus.ACTIVE, deletedAt: null },
                },
                select: { id: true, userId: true },
            });
            if (!doctor) throw httpError(404, "Approved doctor not found");

            const slot = await tx.doctorSlot.findUnique({
                where: { id: payload.slotId },
                select: { doctorId: true, startTime: true, status: true },
            });
            if (!slot) throw httpError(404, "Doctor slot not found");
            if (slot.doctorId !== doctor.id) throw httpError(400, "Slot does not belong to the selected doctor");
            if (slot.startTime <= new Date()) throw httpError(400, "Past slots cannot be booked");

            if (slot.status === SlotStatus.HELD) {
                const expiredHold = await tx.appointment.findFirst({
                    where: {
                        slotId: payload.slotId,
                        status: AppointmentStatus.HELD,
                        holdExpiresAt: { lte: new Date() },
                    },
                    select: { id: true },
                });
                if (expiredHold) {
                    await tx.appointment.update({
                        where: { id: expiredHold.id },
                        data: {
                            status: AppointmentStatus.CANCELLED,
                            cancellationReason: "Hold expired",
                        },
                    });
                    await tx.doctorSlot.update({
                        where: { id: payload.slotId },
                        data: { status: SlotStatus.AVAILABLE },
                    });
                    slot.status = SlotStatus.AVAILABLE;
                }
            }

            if (slot.status !== SlotStatus.AVAILABLE) throw httpError(409, "Slot is not available");

            if (payload.screeningId) {
                const screening = await tx.screening.findFirst({
                    where: { id: payload.screeningId, patientId: patient.id },
                    select: { id: true },
                });
                if (!screening) throw httpError(404, "Screening not found");
            }

            const claimed = await tx.doctorSlot.updateMany({
                where: {
                    id: payload.slotId,
                    doctorId: doctor.id,
                    status: SlotStatus.AVAILABLE,
                    startTime: { gt: new Date() },
                },
                data: { status: SlotStatus.HELD },
            });
            if (claimed.count !== 1) throw httpError(409, "Slot was reserved by another patient");

            const HOLD_DURATION_MS = 10 * 60 * 1000;
            const holdExpiresAt = new Date(Math.min(Date.now() + HOLD_DURATION_MS, slot.startTime.getTime()));

            const appointment = await tx.appointment.create({
                data: {
                    patientId: patient.id,
                    doctorId: doctor.id,
                    slotId: payload.slotId,
                    screeningId: payload.screeningId,
                    status: AppointmentStatus.HELD,
                    holdExpiresAt,
                    ...(payload.historySharingConsent !== undefined && {
                        historySharingConsent: payload.historySharingConsent,
                    }),
                },
                select: appointmentSelect,
            });

            await createNotification({
                userId: doctor.userId,
                title: "New appointment booked",
                message: "A new appointment has been booked. Open your appointments to review the details.",
                notificationType: NotificationType.APPOINTMENT,
                relatedEntityType: "Appointment",
                relatedEntityId: appointment.id,
            }, tx);

            return appointment;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        return presentAppointment(appointment, true);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError
            && (error.code === "P2002" || error.code === "P2034")) {
            throw httpError(409, "Slot was reserved by another patient");
        }
        throw error;
    }
};

const getMyAppointments = async (
    userId: string,
    query: AppointmentListQuery,
) => {
    const patient = await getActivePatient(userId);
    const where: Prisma.AppointmentWhereInput = {
        patientId: patient.id,
        ...(query.status && { status: query.status }),
    };
    const skip = (query.page - 1) * query.limit;

    const [appointments, total] = await prisma.$transaction([
        prisma.appointment.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: query.limit,
            select: appointmentSelect,
        }),
        prisma.appointment.count({ where }),
    ]);

    return {
        appointments: appointments.map((appointment) => presentAppointment(appointment)),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getMyAppointmentById = async (userId: string, appointmentId: string) => {
    const patient = await getActivePatient(userId);
    const appointment = await prisma.appointment.findFirst({
        where: { id: appointmentId, patientId: patient.id },
        select: appointmentSelect,
    });
    if (!appointment) throw httpError(404, "Appointment not found");
    return presentAppointment(appointment, true);
};

const getDoctorAppointmentById = async (userId: string, appointmentId: string) => {
    const appointment = await prisma.appointment.findFirst({
        where: {
            id: appointmentId,
            doctor: {
                userId,
                approvalStatus: DoctorApprovalStatus.APPROVED,
                user: { status: AccountStatus.ACTIVE, deletedAt: null },
            },
        },
        select: appointmentSelect,
    });
    if (!appointment) throw httpError(404, "Appointment not found");
    return presentAppointment(appointment, true);
};

const adminAppointmentSelect = {
    id: true,
    status: true,
    cancellationReason: true,
    cancellationRequestedAt: true,
    holdExpiresAt: true,
    createdAt: true,
    updatedAt: true,
    patient: {
        select: {
            id: true,
            user: { select: { id: true, name: true, email: true } },
        },
    },
    doctor: {
        select: {
            id: true,
            user: { select: { id: true, name: true, email: true } },
            specializations: {
                select: {
                    specialization: { select: { id: true, name: true } },
                },
            },
        },
    },
    slot: { select: { id: true, startTime: true, endTime: true, status: true } },
    payments: {
        where: { purpose: "APPOINTMENT" as const },
        select: { id: true, amount: true, currency: true, status: true, paidAt: true },
        orderBy: { createdAt: "desc" as const },
    },
} satisfies Prisma.AppointmentSelect;

const listAppointmentsForAdmin = async (
    adminUserId: string,
    query: AdminAppointmentListQuery,
) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.AppointmentWhereInput = {
        ...(query.status && { status: query.status }),
        ...(query.doctorId && { doctorId: query.doctorId }),
        ...(query.patientId && { patientId: query.patientId }),
    };

    const [appointments, total] = await prisma.$transaction([
        prisma.appointment.findMany({
            where,
            select: adminAppointmentSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.appointment.count({ where }),
    ]);

    return {
        appointments,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getAppointmentForAdmin = async (adminUserId: string, appointmentId: string) => {
    await requireActiveAdmin(adminUserId);
    const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: adminAppointmentSelect,
    });
    if (!appointment) throw new AppError("Appointment not found", 404);
    return appointment;
};

export const appointmentService = {
    createAppointment,
    getMyAppointments,
    getMyAppointmentById,
    getDoctorAppointmentById,
    listAppointmentsForAdmin,
    getAppointmentForAdmin,
};
