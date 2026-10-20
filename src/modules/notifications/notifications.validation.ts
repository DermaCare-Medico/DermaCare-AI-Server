import { z } from "zod";

import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type NotificationListQuery = {
    page: number;
    limit: number;
    isRead?: boolean;
};

const booleanQueryValue = z.enum(["true", "false"]).transform((value) => value === "true");

const notificationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isRead: booleanQueryValue.optional(),
}).strict();

export const validateNotificationListQuery = validateRequest({
    query: notificationListQuerySchema,
});

const notificationIdParamsSchema = z.object({
    id: uuidSchema,
}).strict();

export const validateNotificationId = validateRequest({
    params: notificationIdParamsSchema,
});
