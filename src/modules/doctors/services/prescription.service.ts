import {
    AccountStatus,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { PatientPrescriptionListQuery } from "../doctors.validation.js";

const getActivePatientProfile = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.PATIENT,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { patientProfile: { select: { id: true } } },
    });

    if (!user) {
        throw new AppError(
            "Only active patients may access prescriptions",
            HTTP_STATUS.FORBIDDEN,
        );
    }
    if (!user.patientProfile) {
        throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    }

    return user.patientProfile;
};

const listPatientPrescriptions = async (
    userId: string,
    query: PatientPrescriptionListQuery,
) => {
    const patient = await getActivePatientProfile(userId);
    const where = {
        sentAt: { not: null },
        appointment: { patientId: patient.id },
    };

    const [prescriptions, total] = await prisma.$transaction([
        prisma.prescription.findMany({
            where,
            orderBy: { sentAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                appointmentId: true,
                sentAt: true,
                doctor: {
                    select: {
                        id: true,
                        user: { select: { name: true } },
                        specialization: { select: { id: true, name: true } },
                    },
                },
                items: { select: { medicineName: true } },
            },
        }),
        prisma.prescription.count({ where }),
    ]);

    return {
        prescriptions: prescriptions.map((prescription) => ({
            id: prescription.id,
            appointmentId: prescription.appointmentId,
            sentAt: prescription.sentAt,
            doctor: prescription.doctor,
            medicineNames: prescription.items.map((item) => item.medicineName),
            itemCount: prescription.items.length,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getPatientPrescriptionById = async (
    userId: string,
    prescriptionId: string,
) => {
    const patient = await getActivePatientProfile(userId);
    const prescription = await prisma.prescription.findFirst({
        where: {
            id: prescriptionId,
            sentAt: { not: null },
            appointment: {
                patientId: patient.id,
            },
        },
        select: {
            sentAt: true,
            advice: true,
            appointment: {
                select: {
                    patient: {
                        select: {
                            user: { select: { name: true } },
                        },
                    },
                },
            },
            doctor: {
                select: {
                    user: { select: { name: true } },
                },
            },
            items: {
                select: {
                    medicineName: true,
                    dosage: true,
                    frequency: true,
                    duration: true,
                },
            },
        },
    });

    if (!prescription) {
        throw new AppError("Prescription not found", HTTP_STATUS.NOT_FOUND);
    }

    return {
        patientName: prescription.appointment.patient.user.name,
        doctorName: prescription.doctor.user.name,
        date: prescription.sentAt,
        medicines: prescription.items.map((item) => ({
            name: item.medicineName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
        })),
        advice: prescription.advice,
    };
};

export const prescriptionService = {
    listPatientPrescriptions,
    getPatientPrescriptionById,
};
