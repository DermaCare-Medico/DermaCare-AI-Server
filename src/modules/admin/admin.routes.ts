import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { adminController } from "./controllers/admin.controller.js";
import { doctorPayoutAdminController } from "./controllers/doctor-payout-admin.controller.js";
import { userManagementController } from "./controllers/user-management.controller.js";
import { doctorVerificationController } from "./controllers/doctor-verification.controller.js";
import { orderController } from "../orders/controllers/order.controller.js";
import { medicineController } from "../stores/controllers/medicine.controller.js";
import { appointmentController } from "../appointments/controllers/appointment.controller.js";
import {
    validateAdminOrderList,
    validateAdminAppointmentId,
    validateAdminAppointmentList,
    validateAdminAuditLogList,
    validateAdminOrderId,
    validateAdminOrderStatus,
    validateAdminDoctorList,
    validateAdminDoctorId,
    validateAdminDoctorApproval,
    validateAdminDoctorApprovalList,
    validateAdminDoctorRejection,
    validateAdminMedicineCreate,
    validateAdminMedicineId,
    validateAdminMedicineList,
    validateAdminMedicineUpdate,
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
adminRouter.post(
    "/doctor-approvals/:id/reject",
    validateAdminDoctorRejection,
    asyncHandler(doctorVerificationController.rejectDoctor),
);
adminRouter.get(
    "/medicines",
    validateAdminMedicineList,
    asyncHandler(medicineController.listMedicinesForAdmin),
);
adminRouter.post(
    "/medicines",
    validateAdminMedicineCreate,
    asyncHandler(medicineController.createMedicineForAdmin),
);
adminRouter.get(
    "/medicines/:id",
    validateAdminMedicineId,
    asyncHandler(medicineController.getMedicineForAdmin),
);
adminRouter.patch(
    "/medicines/:id",
    validateAdminMedicineUpdate,
    asyncHandler(medicineController.updateMedicineForAdmin),
);
adminRouter.delete(
    "/medicines/:id",
    validateAdminMedicineId,
    asyncHandler(medicineController.deactivateMedicineForAdmin),
);
adminRouter.get(
    "/appointments",
    validateAdminAppointmentList,
    asyncHandler(appointmentController.listAppointmentsForAdmin),
);
adminRouter.get(
    "/appointments/:id",
    validateAdminAppointmentId,
    asyncHandler(appointmentController.getAppointmentForAdmin),
);
adminRouter.get(
    "/audit-logs",
    validateAdminAuditLogList,
    asyncHandler(adminController.getAuditLogs),
);

export default adminRouter;
