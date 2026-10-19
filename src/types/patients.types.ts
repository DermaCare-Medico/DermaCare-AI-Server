import { Gender } from "../generated/prisma/enums.js";

export type UpdatePatientProfilePayload = {
    dateOfBirth?: string | null;
    gender?: Gender | null;
    address?: string | null;
    allergies?: string[];
    existingConditions?: string[];
};

