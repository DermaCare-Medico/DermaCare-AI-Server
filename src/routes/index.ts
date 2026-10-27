import { Router } from "express";
import { Role } from "../generated/prisma/client.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import appointmentRoutes from "../modules/appointments/appointments.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import doctorRoutes from "../modules/doctors/doctors.routes.js";
import patientRoutes from "../modules/patients/patients.routes.js";
import paymentRoutes from "../modules/payments/payments.routes.js";
import notificationRoutes from "../modules/notifications/notifications.routes.js";
import adminRoutes from "../modules/admin/admin.routes.js";
import userRoutes from "../modules/user/user.module.js";
import storeRoutes from "../modules/stores/stores.routes.js";
import orderRoutes from "../modules/orders/orders.routes.js";
import prescriptionRoutes from "../modules/prescriptions/prescriptions.routes.js";
import conversationRoutes from "../modules/conversations/conversations.routes.js";

import screeningRoutes from "../modules/screenings/screenings.routes.js";

// Every module router is mounted here, so app.ts never changes when a module is added
const apiRouter = Router();

// Does not touch the database
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use("/medicines", storeRoutes);
apiRouter.use(
  "/admin",
  authenticate,
  authorize(Role.ADMIN),
  adminRoutes,
);
apiRouter.use(
  "/users",
  authenticate,
  authorize(Role.USER, Role.PATIENT, Role.DOCTOR, Role.ADMIN),
  userRoutes,
);
apiRouter.use(
  "/notifications",
  authenticate,
  authorize(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
  notificationRoutes,
);

// Mount before the unscoped patient/doctor authorization chains below.
// Those middleware chains run even when their nested routers do not match.
apiRouter.use("/doctors", doctorRoutes);

apiRouter.use(
  authenticate,
  authorize(Role.PATIENT, Role.DOCTOR),
  appointmentRoutes,
  prescriptionRoutes,
  conversationRoutes,
);
apiRouter.use(
  authenticate,
  authorize(Role.PATIENT),
  patientRoutes,
  paymentRoutes,
  orderRoutes,
);

apiRouter.use("/screenings", screeningRoutes);

export default apiRouter;
