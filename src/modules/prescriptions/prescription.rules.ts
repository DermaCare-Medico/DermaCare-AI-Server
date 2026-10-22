import { AppointmentStatus } from "../../generated/prisma/client.js";

export const canCreatePrescription = (status: AppointmentStatus) =>
  status === AppointmentStatus.COMPLETED;

export const isPrescriptionMutable = (sentAt: Date | null) => sentAt === null;
