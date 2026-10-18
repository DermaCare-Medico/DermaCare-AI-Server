import { asyncHandler } from "../../../middlewares/asyncHandler.js";
import { metaOf } from "./controller.helpers.js";
import {
  emailOnlySchema,
  parse,
  registerRequestSchema,
  verifyOtpSchema,
} from "../auth.validation.js";
import { registrationService } from "../auth.service.js";

export const registrationController = {
  requestOtp: asyncHandler(async (req, res) => {
    const body = parse(registerRequestSchema, req.body);
    const data = await registrationService.requestRegistrationOtp(body);
    res.status(200).json({
      success: true,
      message: "A verification code was sent to your email",
      data,
    });
  }),

  resendOtp: asyncHandler(async (req, res) => {
    const { email } = parse(emailOnlySchema, req.body);
    const data = await registrationService.resendRegistrationOtp(email);
    res.status(200).json({
      success: true,
      message: "A new code was sent to your email",
      data,
    });
  }),

  verifyOtp: asyncHandler(async (req, res) => {
    const body = parse(verifyOtpSchema, req.body);
    const data = await registrationService.verifyRegistration(body, metaOf(req));
    res.status(201).json({ success: true, message: "Account created", data });
  }),
};