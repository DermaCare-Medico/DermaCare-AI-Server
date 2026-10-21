import { AppointmentStatus } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

export const getConsultationCompletionAction = (
  status: AppointmentStatus,
  isPaid: boolean,
) => {
  if (status === AppointmentStatus.COMPLETED) return "ALREADY_COMPLETED" as const;
  if (status !== AppointmentStatus.CONFIRMED) {
    throw new AppError("Only confirmed appointments can be completed", HTTP_STATUS.CONFLICT);
  }
  if (!isPaid) throw new AppError("Paid appointment required", HTTP_STATUS.CONFLICT);
  return "COMPLETE" as const;
};
