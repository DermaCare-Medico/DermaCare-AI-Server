import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { doctorPayoutAdminController } from "./controllers/doctor-payout-admin.controller.js";
import { orderController } from "../orders/controllers/order.controller.js";
import {
    validateAdminOrderList,
    validateAdminPayoutId,
    validateAdminPayoutList,
} from "./admin.validation.js";

const adminRouter = Router();

adminRouter.get(
    "/dashboard",
    asyncHandler(dashboardController.getDashboard),
);

adminRouter.get(
    "/doctor-payments",
    validateAdminPayoutList,
    asyncHandler(doctorPayoutAdminController.listPayouts),
);
adminRouter.post(
    "/doctor-payments/:id/send",
    validateAdminPayoutId,
    asyncHandler(doctorPayoutAdminController.sendPayout),
);
adminRouter.get(
    "/orders",
    validateAdminOrderList,
    asyncHandler(orderController.listOrdersForAdmin),
);

export default adminRouter;
