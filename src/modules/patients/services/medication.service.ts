import {
    AccountStatus,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { CreateMedicationInput } from "../patients.validation.js";

const toDate = (value: string | null | undefined) =>
    value ? new Date(`${value}T00:00:00.000Z`) : value;

const createMyMedication = async (
    userId: string,
    payload: CreateMedicationInput,
) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.PATIENT,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: {
            patientProfile: { select: { id: true } },
        },
    });

    if (!user) {
        throw new AppError(
            "Only active patients may manage medications",
            HTTP_STATUS.FORBIDDEN,
        );
    }
    if (!user.patientProfile) {
        throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    }

    return prisma.currentMedication.create({
        data: {
            patientId: user.patientProfile.id,
            medicineName: payload.medicineName,
            ...(payload.dosage !== undefined && { dosage: payload.dosage }),
            ...(payload.frequency !== undefined && { frequency: payload.frequency }),
            ...(payload.startDate !== undefined && { startDate: toDate(payload.startDate) }),
            ...(payload.endDate !== undefined && { endDate: toDate(payload.endDate) }),
            ...(payload.notes !== undefined && { notes: payload.notes }),
        },
        select: {
            id: true,
            medicineName: true,
            dosage: true,
            frequency: true,
            startDate: true,
            endDate: true,
            notes: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
        },
    });
};

export const medicationService = {
    createMyMedication,
};
