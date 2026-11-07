import { asyncHandler } from "../../../middlewares/asyncHandler.middleware.js";
import { sessionService } from "../services/session.service.js";
import { metaOf } from "./controller.helpers.js";
import { clearRefreshCookie, refreshTokenOf, setRefreshCookie } from "./session-cookie.js";

export const sessionController = {
  refresh: asyncHandler(async (req, res) => {
    const refreshToken = refreshTokenOf(req);
    const data = await sessionService.refresh(refreshToken, metaOf(req));
    setRefreshCookie(res, data.refreshToken);

    res.status(200).json({ success: true, data });
  }),

  logout: asyncHandler(async (req, res) => {
    const refreshToken = refreshTokenOf(req);
    await sessionService.logout(refreshToken);
    clearRefreshCookie(res);

    res.status(200).json({ success: true, message: "Signed out" });
  }),
};
