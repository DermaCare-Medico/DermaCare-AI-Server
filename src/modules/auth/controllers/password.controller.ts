import { asyncHandler } from "../../../middlewares/asyncHandler.js";
import { passwordResetService } from "../services/password-reset.service.js";
import {
  emailOnlySchema,
  parse,
  resetPasswordSchema,
  verifyOtpSchema,
} from "../auth.validation.js";

export const passwordController = {
 
requestOtp: asyncHandler(async (req, res) => {

  const { email } = parse(emailOnlySchema, req.body);

  const data = await passwordResetService.requestPasswordResetOtp(email);

  res.status(200).json({
    success: true,
    message: "If this email is registered, a code was sent",
    data,
  });
}),


  verifyOtp: asyncHandler(async (req, res) => {
    const body = parse(verifyOtpSchema, req.body);
    const data = await passwordResetService.checkPasswordResetOtp(body);
    res.status(200).json({ success: true, data });
  }),

  reset: asyncHandler(async (req, res) => {
    const body = parse(resetPasswordSchema, req.body);
    await passwordResetService.resetPassword(body);

    res
      .status(200)
      .json({ success: true, message: "Password updated. Please sign in" });
  }),
};