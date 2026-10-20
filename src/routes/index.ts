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

// Every module router is mounted here, so app.ts never changes when a module is added
const apiRouter = Router();

// Does not touch the database
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use(
  "/notifications",
  authenticate,
  authorize(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
  notificationRoutes,
);
apiRouter.use(
  authenticate,
  authorize(Role.PATIENT),
  patientRoutes,
  appointmentRoutes,
  paymentRoutes,
  doctorRoutes,
);

export default apiRouter;
