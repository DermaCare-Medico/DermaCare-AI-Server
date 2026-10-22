import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate.middleware.js";
import {
  generalAuthLimiter,
  loginFailureLimiter,
  otpEmailLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  passwordResetLimiter,
} from "../../middlewares/rateLimiter.middleware.js";
import { authController } from "./auth.controller.js";

const { registration, login, password, session, account } = authController;

const router = Router();

// Registration
router.post("/register/request-otp", generalAuthLimiter, otpSendLimiter, otpEmailLimiter, registration.requestOtp);
router.post("/register/resend-otp", generalAuthLimiter, otpSendLimiter, otpEmailLimiter, registration.resendOtp);
router.post("/register/verify-otp", generalAuthLimiter, otpVerifyLimiter, registration.verifyOtp);
// MVP Contract Aliases
router.post("/register", generalAuthLimiter, otpSendLimiter, otpEmailLimiter, registration.requestOtp);
router.post("/resend-otp", generalAuthLimiter, otpSendLimiter, otpEmailLimiter, registration.resendOtp);
router.post("/verify-otp", generalAuthLimiter, otpVerifyLimiter, registration.verifyOtp);

// Login
router.post("/login", generalAuthLimiter, loginFailureLimiter, login.login);
router.post("/google", generalAuthLimiter, login.google);

// Forgot password
router.post("/forgot-password/request-otp", passwordResetLimiter, otpEmailLimiter, password.requestOtp);
router.post("/forgot-password/verify-otp", otpVerifyLimiter, password.verifyOtp);
router.post("/forgot-password/reset", otpVerifyLimiter, password.reset);
// MVP Contract Aliases
router.post("/forgot-password", passwordResetLimiter, otpEmailLimiter, password.requestOtp);
router.post("/reset-password", otpVerifyLimiter, password.reset);

// Sessions
router.post("/refresh", generalAuthLimiter, session.refresh);
router.post("/refresh-token", generalAuthLimiter, session.refresh);
router.post("/logout", generalAuthLimiter, session.logout);

// Signed-in account
router.get("/me", authenticate, account.me);
router.post("/identities/google", authenticate, account.linkGoogle);
router.delete("/identities/:provider", authenticate, account.unlinkIdentity);

export default router;