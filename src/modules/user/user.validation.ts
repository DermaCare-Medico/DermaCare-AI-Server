import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";

export type UpdateUserProfileInput = {
    name?: string;
    phone?: string | null;
};

const updateUserProfileSchema = z.object({
    name: z.string().trim().min(2).max(150).optional(),
    phone: z.string().trim().min(7).max(30).nullable().optional(),
}).strict().refine(
    (value) => value.name !== undefined || value.phone !== undefined,
    { message: "At least one profile field is required" },
);

export const validateUpdateUserProfile = validateRequest({
    body: updateUserProfileSchema,
});
