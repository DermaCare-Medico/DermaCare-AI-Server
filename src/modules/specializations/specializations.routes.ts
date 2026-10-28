import { Router } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { specializationController } from "./specialization.controller.js";

const specializationRouter = Router();

specializationRouter.get("/", asyncHandler(specializationController.list));

export default specializationRouter;
