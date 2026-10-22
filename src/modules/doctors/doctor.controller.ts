
import { doctorProfileController } from "./controllers/doctor-profile.controller.js";
import { doctorListController } from "./controllers/doctor-list.controller.js";

export const doctorController = {
  ...doctorProfileController,
  ...doctorListController,
};
