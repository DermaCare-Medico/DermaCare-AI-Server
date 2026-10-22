import type { Request, Response } from "express";
import { AppError } from "../../../shared/errors/AppError.js";
import {
  listConversationMessages,
  sendConversationMessage,
} from "../services/message.service.js";
import {
  conversationParamsSchema,
  messageListQuerySchema,
  sendMessageSchema,
} from "../conversations.validation.js";

const userId = (req: Request) => {
  if (!req.auth) throw new AppError("Authentication required", 401);
  return req.auth.userId;
};

export async function listMessagesController(req: Request, res: Response) {
  const { conversationId } = conversationParamsSchema.parse(req.params);
  const { cursor, limit } = messageListQuerySchema.parse(req.query);
  const data = await listConversationMessages(userId(req), conversationId, cursor, limit);
  res.status(200).json({ success: true, data });
}

export async function sendMessageController(req: Request, res: Response) {
  const { conversationId } = conversationParamsSchema.parse(req.params);
  const { content } = sendMessageSchema.parse(req.body);
  const data = await sendConversationMessage(userId(req), conversationId, content);
  res.status(201).json({ success: true, data });
}
