import { accountController } from "./controllers/account.controller.js";
import { loginController } from "./controllers/login.controller.js";
import { passwordController } from "./controllers/password.controller.js";
import { registrationController } from "./controllers/registration.controller.js";
import { sessionController } from "./controllers/session.controller.js";

export const authController = {
  registration: registrationController,
  login: loginController,
  password: passwordController,
  session: sessionController,
  account: accountController,
};