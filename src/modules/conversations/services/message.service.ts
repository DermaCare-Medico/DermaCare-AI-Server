import { NotificationType, Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { createNotificationIfEligible } from "../../notifications/services/notification.service.js";
import {
  conversationAccessSelect,
  enforceConversationAccess,
} from "./conversation.service.js";

export async function listConversationMessages(
  userId: string,
  conversationId: string,
  cursor: string | undefined,
  limit: number,
) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId }, select: conversationAccessSelect,
  });
  if (!conversation) throw new AppError("Conversation not found", 404);
  enforceConversationAccess(userId, conversation, false);

  if (cursor) {
    const cursorMessage = await prisma.message.findFirst({
      where: { id: cursor, conversationId }, select: { id: true, sentAt: true },
    });
    if (!cursorMessage) throw new AppError("Message cursor not found", 400);
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        OR: [
          { sentAt: { gt: cursorMessage.sentAt } },
          { sentAt: cursorMessage.sentAt, id: { gt: cursorMessage.id } },
        ],
      },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, senderId: true, messageText: true, sentAt: true, readAt: true },
    });
    return { messages, nextCursor: messages.at(-1)?.id ?? cursor };
  }

  const newest = await prisma.message.findMany({
    where: { conversationId },
    orderBy: [{ sentAt: "desc" }, { id: "desc" }],
    take: limit,
    select: { id: true, senderId: true, messageText: true, sentAt: true, readAt: true },
  });
  const messages = newest.reverse();
  return { messages, nextCursor: messages.at(-1)?.id ?? null };
}

export async function sendConversationMessage(
  userId: string,
  conversationId: string,
  content: string,
) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findUnique({
      where: { id: conversationId }, select: conversationAccessSelect,
    });
    if (!conversation) throw new AppError("Conversation not found", 404);
    const { recipientUserId } = enforceConversationAccess(userId, conversation, true);

    const message = await tx.message.create({
      data: { conversationId, senderId: userId, messageText: content },
      select: { id: true, conversationId: true, senderId: true, messageText: true, sentAt: true },
    });
    await createNotificationIfEligible({
      userId: recipientUserId,
      title: "New consultation message",
      message: "You received a new message in a consultation conversation.",
      notificationType: NotificationType.MESSAGE,
      relatedEntityType: "Conversation",
      relatedEntityId: conversationId,
    }, tx);
    return message;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
