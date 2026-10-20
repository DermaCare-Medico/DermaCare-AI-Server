import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { doctorPayoutAdminController } from "./controllers/doctor-payout-admin.controller.js";
import { userManagementController } from "./controllers/user-management.controller.js";
import { doctorVerificationController } from "./controllers/doctor-verification.controller.js";
import { orderController } from "../orders/controllers/order.controller.js";
import {
    validateAdminOrderList,
    validateAdminOrderId,
    validateAdminOrderStatus,
    validateAdminDoctorList,
    validateAdminDoctorId,
    validateAdminDoctorApproval,
    validateAdminDoctorApprovalList,
    validateAdminPayoutId,
    validateAdminPayoutList,
    validateAdminUserList,
    validateAdminUserId,
    validateAdminUserStatus,
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
adminRouter.get(
    "/orders/:id",
    validateAdminOrderId,
    asyncHandler(orderController.getOrderForAdmin),
);
adminRouter.patch(
    "/orders/:id/status",
    validateAdminOrderStatus,
    asyncHandler(orderController.updateOrderStatusForAdmin),
);
adminRouter.get(
    "/users",
    validateAdminUserList,
    asyncHandler(userManagementController.listUsers),
);
adminRouter.get(
    "/users/:id",
    validateAdminUserId,
    asyncHandler(userManagementController.getUser),
);
adminRouter.patch(
    "/users/:id/status",
    validateAdminUserStatus,
    asyncHandler(userManagementController.updateUserStatus),
);
adminRouter.get(
    "/doctors",
    validateAdminDoctorList,
    asyncHandler(userManagementController.listDoctors),
);
adminRouter.get(
    "/doctors/:id",
    validateAdminDoctorId,
    asyncHandler(doctorVerificationController.getDoctor),
);
adminRouter.get(
    "/doctor-approvals",
    validateAdminDoctorApprovalList,
    asyncHandler(doctorVerificationController.listPendingApprovals),
);
adminRouter.post(
    "/doctor-approvals/:id/approve",
    validateAdminDoctorApproval,
    asyncHandler(doctorVerificationController.approveDoctor),
);

export default adminRouter;
