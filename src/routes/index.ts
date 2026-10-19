import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";

// Every module router is mounted here, so app.ts never changes when a module is added
const apiRouter = Router();

// Does not touch the database
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({ success: true, status: "ok" });
});

apiRouter.use("/auth", authRoutes);
// apiRouter.use("/doctors", doctorRoutes);
// apiRouter.use("/appointments", appointmentRoutes);

export default apiRouter;