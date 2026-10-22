import { AppointmentStatus, Role } from "../../../generated/prisma/client.js";

export const noShowAuditData = (actorUserId: string, appointmentId: string, actorRole: Role) => ({
  actorUserId,
  action: "APPOINTMENT_MARKED_NO_SHOW",
  entityType: "Appointment",
  entityId: appointmentId,
  before: { status: AppointmentStatus.CONFIRMED },
  after: { status: AppointmentStatus.NO_SHOW },
  metadata: { actorRole },
});
