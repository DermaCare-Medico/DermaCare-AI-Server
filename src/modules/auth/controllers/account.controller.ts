import { asyncHandler } from "../../../middlewares/asyncHandler.js";
import { accountService } from "../services/account.service.js";
import { userIdOf } from "./controller.helpers.js";
import {
  linkGoogleSchema,
  parse,
  providerParamSchema,
} from "../auth.validation.js";

export const accountController = {
  me: asyncHandler(async (req, res) => {
    const data = await accountService.me(userIdOf(req));

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