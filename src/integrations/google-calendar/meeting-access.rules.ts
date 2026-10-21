import { AppointmentStatus, TransactionStatus } from "../../generated/prisma/client.js";

export const canExposeMeeting = (
  appointmentStatus: AppointmentStatus,
  paymentStatus: TransactionStatus | null,
) => appointmentStatus === AppointmentStatus.CONFIRMED
  && paymentStatus === TransactionStatus.PAID;
