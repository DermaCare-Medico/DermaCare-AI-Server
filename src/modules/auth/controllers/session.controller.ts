import { asyncHandler } from "../../../middlewares/asyncHandler.middleware.js";
import { sessionService } from "../services/session.service.js";
import { metaOf } from "./controller.helpers.js";
import { parse, refreshSchema } from "../auth.validation.js";

export const sessionController = {
  refresh: asyncHandler(async (req, res) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    const data = await sessionService.refresh(refreshToken, metaOf(req));

    res.status(200).json({ success: true, data });
  }),

  logout: asyncHandler(async (req, res) => {
    const { refreshToken } = parse(refreshSchema, req.body);
    await sessionService.logout(refreshToken);

    res.status(200).json({ success: true, message: "Signed out" });
  }),
};