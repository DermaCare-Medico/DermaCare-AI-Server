import { NotificationType } from "../generated/prisma/enums.js";

export type CreateNotificationInput = {
    userId: string;
    title: string;
    message: string;
    notificationType: NotificationType;
    relatedEntityType?: string;
    relatedEntityId?: string;
};