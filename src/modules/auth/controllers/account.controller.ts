import { asyncHandler } from "../../../middlewares/asyncHandler.middleware.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { accountService } from "../services/account.service.js";
import { userIdOf } from "./controller.helpers.js";
import {
  linkGoogleSchema,
  parse,
  providerParamSchema,
} from "../auth.validation.js";

export const accountController = {
  me: asyncHandler(async (req, res) => {
    if (!req.auth?.account) throw new AppError("Authentication required", 401);
    const data = accountService.me(req.auth.account);

    res.status(200).json({ success: true, data });
  }),

  linkGoogle: asyncHandler(async (req, res) => {
    const { idToken } = parse(linkGoogleSchema, req.body);
    await accountService.linkGoogle(userIdOf(req), idToken);

    res.status(200).json({ success: true, message: "Google account linked" });
  }),

  unlinkIdentity: asyncHandler(async (req, res) => {
    const { provider } = parse(providerParamSchema, req.params);
    await accountService.unlinkIdentity(userIdOf(req), provider);

    res.status(200).json({ success: true, message: "Sign-in method removed" });
  }),
};
