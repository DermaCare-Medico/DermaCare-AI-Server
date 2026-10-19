
import { prisma } from "../../../lib/prisma.js";
import { UpdatePatientProfilePayload } from "../../../types/patients.types.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";


//patient profile get api
const getMyProfile = async (userId: string) => {
    const patient = await prisma.patientProfile.findUnique({
        where: {
            userId,
        },
        select: {
            id: true,
            dateOfBirth: true,
            gender: true,
            address: true,
            allergies: true,
            existingConditions: true,

            currentMedications: {
                where: {
                    isActive: true,
                },
                select: {
                    medicineName: true,
                    dosage: true,
                    frequency: true,
                },
            },
        },
    });

    if (!patient) {
        throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    }

    return patient;
};

//patient profile patch api



export const updateMyProfile = async (
    userId: string,
    payload: UpdatePatientProfilePayload
) => {
    // Find the logged-in patient's profile
    const patient = await prisma.patientProfile.findUnique({
        where: {
            userId,
        },
        select: {
            id: true,
        },
    });

    if (!patient) {
        throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    }

    // Update only provided fields
    const updatedProfile = await prisma.patientProfile.update({
        where: {
            id: patient.id,
        },
        data: {
            ...(payload.dateOfBirth !== undefined && {
                dateOfBirth: payload.dateOfBirth
                    ? new Date(`${payload.dateOfBirth}T00:00:00.000Z`)
                    : null,
            }),

            ...(payload.gender !== undefined && {
                gender: payload.gender,
            }),

            ...(payload.address !== undefined && {
                address: payload.address,
            }),

            ...(payload.allergies !== undefined && {
                allergies: payload.allergies,
            }),

            ...(payload.existingConditions !== undefined && {
                existingConditions: payload.existingConditions,
            }),
        },
        select: {
            id: true,
            dateOfBirth: true,
            gender: true,
            address: true,
            allergies: true,
            existingConditions: true,
            updatedAt: true,
        },
    });

    return updatedProfile;
};

export const patientService = {
    getMyProfile,
    updateMyProfile,
}
