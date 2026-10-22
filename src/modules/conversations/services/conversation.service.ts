import {
  AppointmentStatus,
  ConversationStatus,
  Prisma,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  assertAppointmentChatEligible,
  assertConversationOpen,
  assertConversationParticipant,
  chatClosesAt,
} from "./conversation-access.service.js";

const conversationSelect = {
  id: true,
  appointmentId: true,
  status: true,
  openedAt: true,
  closesAt: true,
  closedAt: true,
  patient: { select: { user: { select: { id: true, name: true } } } },
  doctor: { select: { user: { select: { id: true, name: true } } } },
  _count: { select: { messages: true } },
} satisfies Prisma.ConversationSelect;

export async function openAppointmentConversation(userId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      patientId: true,
      doctorId: true,
      status: true,
      updatedAt: true,
      patient: { select: { userId: true } },
      doctor: { select: { userId: true } },
      payments: {
        where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
        select: { id: true },
        take: 1,
      },
      conversation: { select: conversationSelect },
    },
  });
  if (!appointment) throw new AppError("Appointment not found", 404);
  assertConversationParticipant(userId, {
    patientUserId: appointment.patient.userId,
    doctorUserId: appointment.doctor.userId,
  });
  assertAppointmentChatEligible({
    appointmentStatus: appointment.status,
    isPaid: appointment.payments.length > 0,
    patientUserId: appointment.patient.userId,
    doctorUserId: appointment.doctor.userId,
  });
  if (appointment.conversation) return appointment.conversation;

  const closesAt = chatClosesAt(appointment.updatedAt);
  if (closesAt <= new Date()) throw new AppError("Conversation window has expired", 409);
  try {
    return await prisma.conversation.create({
      data: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        closesAt,
      },
      select: conversationSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.conversation.findUniqueOrThrow({
        where: { appointmentId },
        select: conversationSelect,
      });
    }
    throw error;
  }
}

export const conversationAccessSelect = {
  id: true,
  status: true,
  closesAt: true,
  patient: { select: { userId: true } },
  doctor: { select: { userId: true } },
  appointment: {
    select: {
      status: true,
      payments: {
        where: { purpose: TransactionPurpose.APPOINTMENT, status: TransactionStatus.PAID },
        select: { id: true },
        take: 1,
      },
    },
  },
} satisfies Prisma.ConversationSelect;

export type ConversationAccess = Prisma.ConversationGetPayload<{
  select: typeof conversationAccessSelect;
}>;

export function enforceConversationAccess(
  userId: string,
  conversation: ConversationAccess,
  requireOpen: boolean,
) {
  const state = {
    appointmentStatus: conversation.appointment.status,
    isPaid: conversation.appointment.payments.length > 0,
    patientUserId: conversation.patient.userId,
    doctorUserId: conversation.doctor.userId,
    closesAt: conversation.closesAt,
    conversationStatus: conversation.status,
  };
  assertConversationParticipant(userId, state);
  assertAppointmentChatEligible(state);
  if (requireOpen) assertConversationOpen(state);
  return {
    recipientUserId: userId === state.patientUserId ? state.doctorUserId : state.patientUserId,
  };
}
