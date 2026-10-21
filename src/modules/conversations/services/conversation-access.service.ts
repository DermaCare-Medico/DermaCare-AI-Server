import {
  AppointmentStatus,
  ConversationStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const CHAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface ConversationAccessState {
  appointmentStatus: AppointmentStatus;
  isPaid: boolean;
  patientUserId: string;
  doctorUserId: string;
  closesAt?: Date | null;
  conversationStatus?: ConversationStatus;
}

export function assertConversationParticipant(
  userId: string,
  state: Pick<ConversationAccessState, "patientUserId" | "doctorUserId">,
) {
  if (userId !== state.patientUserId && userId !== state.doctorUserId) {
    throw new AppError("Conversation not found", 404);
  }
}

export function assertAppointmentChatEligible(state: ConversationAccessState) {
  if (state.appointmentStatus !== AppointmentStatus.COMPLETED || !state.isPaid) {
    throw new AppError("Chat requires a completed, paid appointment", 409);
  }
}

export function assertConversationOpen(state: ConversationAccessState, now = new Date()) {
  if (
    state.conversationStatus === ConversationStatus.CLOSED
    || !state.closesAt
    || state.closesAt <= now
  ) {
    throw new AppError("Conversation is closed", 409);
  }
}

export const chatClosesAt = (completedAt: Date) =>
  new Date(completedAt.getTime() + CHAT_WINDOW_MS);

export const paidAppointmentFilter = {
  some: {
    purpose: TransactionPurpose.APPOINTMENT,
    status: TransactionStatus.PAID,
  },
} as const;
