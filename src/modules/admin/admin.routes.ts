import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { dashboardController } from "./controllers/dashboard.controller.js";

const adminRouter = Router();

adminRouter.get(
    "/dashboard",
    asyncHandler(dashboardController.getDashboard),
);

export default adminRouter;
