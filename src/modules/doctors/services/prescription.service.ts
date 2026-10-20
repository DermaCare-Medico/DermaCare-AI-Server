import {
    AccountStatus,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";

const getPatientPrescriptionById = async (
    userId: string,
    prescriptionId: string,
) => {
    const prescription = await prisma.prescription.findFirst({
        where: {
            id: prescriptionId,
            sentAt: { not: null },
            appointment: {
                patient: {
                    userId,
                    user: {
                        role: Role.PATIENT,
                        status: AccountStatus.ACTIVE,
                        deletedAt: null,
                    },
                },
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
    getPatientPrescriptionById,
};
