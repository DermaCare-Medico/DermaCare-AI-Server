import { Router } from "express";
import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { openAppointmentConversationController } from "./controllers/conversation.controller.js";
import { listMessagesController, sendMessageController } from "./controllers/message.controller.js";

const router = Router();

router.get(
  "/conversations/appointment/:appointmentId",
  asyncHandler(openAppointmentConversationController),
);
router.get(
  "/conversations/:conversationId/messages",
  asyncHandler(listMessagesController),
);
router.post(
  "/conversations/:conversationId/messages",
  asyncHandler(sendMessageController),
);

export default router;
