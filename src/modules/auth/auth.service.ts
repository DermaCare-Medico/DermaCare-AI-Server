// auth/auth.service.ts
import { accountService } from "./services/account.service.js";
import { loginService } from "./services/login.service.js";
import { passwordResetService } from "./services/password-reset.service.js";
import { registrationService } from "./services/registration.service.js";
import { sessionService } from "./services/session.service.js";

export const authService = {
  registration: registrationService,
  login: loginService,
  passwordReset: passwordResetService,
  session: sessionService,
  account: accountService,
};