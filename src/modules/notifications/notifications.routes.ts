import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { notificationController } from "./controllers/notification.controller.js";
import {
    validateNotificationId,
    validateNotificationListQuery,
} from "./notifications.validation.js";

const notificationRouter = Router();

notificationRouter.get(
    "/unread-count",
    asyncHandler(notificationController.getUnreadCount),
);

notificationRouter.get(
    "/",
    validateNotificationListQuery,
    asyncHandler(notificationController.listNotifications),
);

notificationRouter.patch(
    "/read-all",
    asyncHandler(notificationController.markAllAsRead),
);

notificationRouter.patch(
    "/:id/read",
    validateNotificationId,
    asyncHandler(notificationController.markAsRead),
);

export default notificationRouter;
