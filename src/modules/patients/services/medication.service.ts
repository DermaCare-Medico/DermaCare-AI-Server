import {
    AccountStatus,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type {
    CreateMedicationInput,
    UpdateMedicationInput,
} from "../patients.validation.js";

const toDate = (value: string | null | undefined): Date | null | undefined =>
    value == null ? value : new Date(`${value}T00:00:00.000Z`);

const getActivePatientProfile = async (userId: string) => {
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

    return user.patientProfile;
};

const createMyMedication = async (
    userId: string,
    payload: CreateMedicationInput,
) => {
    const patient = await getActivePatientProfile(userId);

    return prisma.currentMedication.create({
        data: {
            patientId: patient.id,
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

const updateMyMedication = async (
    userId: string,
    medicationId: string,
    payload: UpdateMedicationInput,
) => {
    const patient = await getActivePatientProfile(userId);
    const medication = await prisma.currentMedication.findFirst({
        where: {
            id: medicationId,
            patientId: patient.id,
            isActive: true,
        },
        select: {
            id: true,
            startDate: true,
            endDate: true,
        },
    });

    if (!medication) {
        throw new AppError("Medication not found", HTTP_STATUS.NOT_FOUND);
    }

    const startDate = payload.startDate !== undefined
        ? toDate(payload.startDate)
        : medication.startDate;
    const endDate = payload.endDate !== undefined
        ? toDate(payload.endDate)
        : medication.endDate;

    if (startDate && endDate && endDate < startDate) {
        throw new AppError(
            "endDate cannot be before startDate",
            HTTP_STATUS.BAD_REQUEST,
        );
    }

    return prisma.currentMedication.update({
        where: { id: medication.id },
        data: {
            ...(payload.medicineName !== undefined && {
                medicineName: payload.medicineName,
            }),
            ...(payload.dosage !== undefined && { dosage: payload.dosage }),
            ...(payload.frequency !== undefined && { frequency: payload.frequency }),
            ...(payload.startDate !== undefined && { startDate }),
            ...(payload.endDate !== undefined && { endDate }),
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

const deactivateMyMedication = async (
    userId: string,
    medicationId: string,
) => {
    const patient = await getActivePatientProfile(userId);
    const result = await prisma.currentMedication.updateMany({
        where: {
            id: medicationId,
            patientId: patient.id,
            isActive: true,
        },
        data: {
            isActive: false,
        },
    });

    if (result.count !== 1) {
        throw new AppError("Medication not found", HTTP_STATUS.NOT_FOUND);
    }

    return {
        id: medicationId,
        isActive: false,
    };
};

export const medicationService = {
    createMyMedication,
    updateMyMedication,
    deactivateMyMedication,
};
