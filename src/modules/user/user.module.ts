import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { userProfileController } from "./controllers/user-profile.controller.js";
import { validateUpdateUserProfile } from "./user.validation.js";

const userRouter = Router();

userRouter.get("/me", asyncHandler(userProfileController.getMyProfile));
userRouter.patch(
    "/me",
    validateUpdateUserProfile,
    asyncHandler(userProfileController.updateMyProfile),
);

export default userRouter;
