import { SlotStatus } from "../../../generated/prisma/client.js";

export const isDiscoverableDoctorSlot = (slot: {
  status: SlotStatus;
  startTime: Date;
}, now: Date) => slot.status === SlotStatus.AVAILABLE && slot.startTime > now;

export const slotsOverlap = (
  first: { startTime: Date; endTime: Date },
  second: { startTime: Date; endTime: Date },
) => first.startTime < second.endTime && first.endTime > second.startTime;
