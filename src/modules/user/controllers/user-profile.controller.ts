import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { userProfileService } from "../services/user-profile.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const getMyProfile = async (req: Request, res: Response) => {
    const profile = await userProfileService.getMyProfile(getUserId(req));
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Profile retrieved successfully",
        data: profile,
    });
};

const updateMyProfile = async (req: Request, res: Response) => {
    const profile = await userProfileService.updateMyProfile(getUserId(req), req.body);
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Profile updated successfully",
        data: profile,
    });
};

export const userProfileController = { getMyProfile, updateMyProfile };
