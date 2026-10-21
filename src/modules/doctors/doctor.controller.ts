
import { doctorProfileController } from "./controllers/doctor-profile.controller.js";
import { doctorListController } from "./controllers/doctor-list.controller.js";
import { doctorApprovalController } from "./controllers/doctor-approval.controller.js";

export const doctorController = {
  ...doctorProfileController,
  ...doctorListController,
  ...doctorApprovalController,
};
