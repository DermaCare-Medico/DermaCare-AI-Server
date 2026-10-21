import { z } from "zod";

export const appointmentConversationParamsSchema = z.object({
  appointmentId: z.string().uuid(),
});

export const conversationParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const messageListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
}).strict();
