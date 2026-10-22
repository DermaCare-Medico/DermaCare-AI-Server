import assert from "node:assert/strict";
import test from "node:test";
import { AppointmentStatus, ConversationStatus } from "../../../generated/prisma/client.js";
import {
  assertAppointmentChatEligible,
  assertConversationOpen,
  assertConversationParticipant,
  chatClosesAt,
} from "./conversation-access.service.js";

const participants = { patientUserId: "patient", doctorUserId: "doctor" };

test("only the assigned Patient and Doctor are conversation participants", () => {
  assert.doesNotThrow(() => assertConversationParticipant("patient", participants));
  assert.doesNotThrow(() => assertConversationParticipant("doctor", participants));
  assert.throws(() => assertConversationParticipant("other", participants));
});

test("chat requires both completed appointment and paid transaction", () => {
  assert.doesNotThrow(() => assertAppointmentChatEligible({
    ...participants, appointmentStatus: AppointmentStatus.COMPLETED, isPaid: true,
  }));
  assert.throws(() => assertAppointmentChatEligible({
    ...participants, appointmentStatus: AppointmentStatus.CONFIRMED, isPaid: true,
  }));
  assert.throws(() => assertAppointmentChatEligible({
    ...participants, appointmentStatus: AppointmentStatus.COMPLETED, isPaid: false,
  }));
});

test("sending is allowed only before the conversation closes", () => {
  const completedAt = new Date("2026-10-21T10:00:00Z");
  const closesAt = chatClosesAt(completedAt);
  assert.equal(closesAt.toISOString(), "2026-10-28T10:00:00.000Z");
  assert.doesNotThrow(() => assertConversationOpen({
    ...participants,
    appointmentStatus: AppointmentStatus.COMPLETED,
    isPaid: true,
    conversationStatus: ConversationStatus.OPEN,
    closesAt,
  }, new Date("2026-10-28T09:59:59Z")));
  assert.throws(() => assertConversationOpen({
    ...participants,
    appointmentStatus: AppointmentStatus.COMPLETED,
    isPaid: true,
    conversationStatus: ConversationStatus.OPEN,
    closesAt,
  }, closesAt));
});
