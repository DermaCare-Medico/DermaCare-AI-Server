import { asyncHandler } from "../../../middlewares/asyncHandler.middleware.js";
import { loginService } from "../services/login.service.js";
import { metaOf } from "./controller.helpers.js";
import { googleAuthSchema, loginSchema, parse } from "../auth.validation.js";
import { setRefreshCookie } from "./session-cookie.js";

export const loginController = {
  login: asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const data = await loginService.login(body, metaOf(req));
    setRefreshCookie(res, data.refreshToken);
    res.status(200).json({ success: true, data });
  }),

  google: asyncHandler(async (req, res) => {
    const body = parse(googleAuthSchema, req.body);
    const data = await loginService.googleAuth(body, metaOf(req));
    setRefreshCookie(res, "refreshToken" in data ? data.refreshToken : undefined);
    res.status(200).json({ success: true, data });
  }),
};
