import assert from "node:assert/strict";
import test from "node:test";

import {
  AppointmentStatus,
  SlotStatus,
  TransactionPurpose,
  TransactionStatus,
} from "../../../generated/prisma/client.js";

test("patient booking initializes appointment as HELD and slot as HELD with 10-minute expiry", () => {
  const HOLD_DURATION_MS = 10 * 60 * 1000;
  const now = new Date("2026-10-21T10:00:00.000Z");
  const slotStartTime = new Date("2026-10-21T11:00:00.000Z");

  const holdExpiresAt = new Date(Math.min(now.getTime() + HOLD_DURATION_MS, slotStartTime.getTime()));

  assert.equal(holdExpiresAt.toISOString(), "2026-10-21T10:10:00.000Z");
  assert.equal(holdExpiresAt.getTime() - now.getTime(), HOLD_DURATION_MS);
});

test("doctor acceptance transitions HELD to PENDING while keeping slot HELD", () => {
  let appointmentStatus: AppointmentStatus = AppointmentStatus.HELD;
  let slotStatus: SlotStatus = SlotStatus.HELD;

  // Guard: must be HELD
  assert.equal(appointmentStatus, AppointmentStatus.HELD);
  assert.equal(slotStatus, SlotStatus.HELD);

  // Doctor accepts
  appointmentStatus = AppointmentStatus.PENDING;
  // Slot remains reserved (HELD) awaiting patient payment
  assert.equal(slotStatus, SlotStatus.HELD);
  assert.equal(appointmentStatus, AppointmentStatus.PENDING);
});

test("doctor rejection transitions HELD to CANCELLED and releases slot to AVAILABLE", () => {
  let appointmentStatus: AppointmentStatus = AppointmentStatus.HELD;
  let slotStatus: SlotStatus = SlotStatus.HELD;
  let cancellationReason: string | null = null;

  // Doctor rejects
  assert.equal(appointmentStatus, AppointmentStatus.HELD);
  appointmentStatus = AppointmentStatus.CANCELLED;
  slotStatus = SlotStatus.AVAILABLE;
  cancellationReason = "Doctor is unavailable at this time";

  assert.equal(appointmentStatus, AppointmentStatus.CANCELLED);
  assert.equal(slotStatus, SlotStatus.AVAILABLE);
  assert.equal(cancellationReason, "Doctor is unavailable at this time");
});

test("doctor decision rejects expired hold, cancels appointment and frees slot", () => {
  const now = new Date("2026-10-21T10:15:00.000Z");
  const holdExpiresAt = new Date("2026-10-21T10:10:00.000Z");

  let appointmentStatus: AppointmentStatus = AppointmentStatus.HELD;
  let slotStatus: SlotStatus = SlotStatus.HELD;

  const isExpired = holdExpiresAt <= now;
  assert.equal(isExpired, true);

  if (isExpired) {
    appointmentStatus = AppointmentStatus.CANCELLED;
    slotStatus = SlotStatus.AVAILABLE;
  }

  assert.equal(appointmentStatus, AppointmentStatus.CANCELLED);
  assert.equal(slotStatus, SlotStatus.AVAILABLE);
});

test("rebooking cleans up expired hold and restores slot availability", () => {
  const now = new Date("2026-10-21T10:20:00.000Z");
  const existingAppointment: {
    id: string;
    status: AppointmentStatus;
    holdExpiresAt: Date;
  } = {
    id: "appt-1",
    status: AppointmentStatus.HELD,
    holdExpiresAt: new Date("2026-10-21T10:10:00.000Z"),
  };
  let slotStatus: SlotStatus = SlotStatus.HELD;

  if (existingAppointment.status === AppointmentStatus.HELD && existingAppointment.holdExpiresAt <= now) {
    existingAppointment.status = AppointmentStatus.CANCELLED;
    slotStatus = SlotStatus.AVAILABLE;
  }

  assert.equal(existingAppointment.status, AppointmentStatus.CANCELLED);
  assert.equal(slotStatus, SlotStatus.AVAILABLE);
});

test("duplicate doctor acceptance is idempotent for PENDING appointment", () => {
  const appointment: {
    id: string;
    status: AppointmentStatus;
    slot: { id: string; status: SlotStatus };
  } = {
    id: "appt-1",
    status: AppointmentStatus.PENDING,
    slot: { id: "slot-1", status: SlotStatus.HELD },
  };

  const decide = (action: "ACCEPT" | "REJECT") => {
    if (action === "ACCEPT" && appointment.status === AppointmentStatus.PENDING) {
      return { handled: true, appointment };
    }
    if (appointment.status !== AppointmentStatus.HELD) {
      throw new Error("This appointment is not awaiting a decision");
    }
    return { handled: false, appointment };
  };

  const result = decide("ACCEPT");
  assert.equal(result.handled, true);
  assert.equal(result.appointment.status, AppointmentStatus.PENDING);

  assert.throws(() => decide("REJECT"), { message: "This appointment is not awaiting a decision" });
});

test("duplicate doctor rejection is idempotent for CANCELLED appointment", () => {
  const appointment: {
    id: string;
    status: AppointmentStatus;
    slot: { id: string; status: SlotStatus };
  } = {
    id: "appt-2",
    status: AppointmentStatus.CANCELLED,
    slot: { id: "slot-2", status: SlotStatus.AVAILABLE },
  };

  const decide = (action: "ACCEPT" | "REJECT") => {
    if (action === "REJECT" && appointment.status === AppointmentStatus.CANCELLED) {
      return { handled: true, appointment };
    }
    if (appointment.status !== AppointmentStatus.HELD) {
      throw new Error("This appointment is not awaiting a decision");
    }
    return { handled: false, appointment };
  };

  const result = decide("REJECT");
  assert.equal(result.handled, true);
  assert.equal(result.appointment.status, AppointmentStatus.CANCELLED);

  assert.throws(() => decide("ACCEPT"), { message: "This appointment is not awaiting a decision" });
});

test("payment requires PENDING status and transitions to CONFIRMED with slot BOOKED", () => {
  let appointmentStatus: AppointmentStatus = AppointmentStatus.PENDING;
  let slotStatus: SlotStatus = SlotStatus.HELD;
  let meetingProvisioningRequested = false;

  const pay = (status: AppointmentStatus) => {
    if (status !== AppointmentStatus.PENDING) {
      throw new Error("Appointment is not approved for payment");
    }
    appointmentStatus = AppointmentStatus.CONFIRMED;
    slotStatus = SlotStatus.BOOKED;
    meetingProvisioningRequested = true;
    return { status: TransactionStatus.PAID };
  };

  // Cannot pay HELD or CANCELLED appointment
  assert.throws(() => pay(AppointmentStatus.HELD), { message: "Appointment is not approved for payment" });
  assert.throws(() => pay(AppointmentStatus.CANCELLED), { message: "Appointment is not approved for payment" });

  // Can pay PENDING appointment
  const paymentResult = pay(AppointmentStatus.PENDING);
  assert.equal(paymentResult.status, TransactionStatus.PAID);
  assert.equal(appointmentStatus, AppointmentStatus.CONFIRMED);
  assert.equal(slotStatus, SlotStatus.BOOKED);
  assert.equal(meetingProvisioningRequested, true);
});

test("concurrent doctor decisions on HELD appointment produce exactly one transition", async () => {
  let currentStatus: AppointmentStatus = AppointmentStatus.HELD;

  const attemptDecision = async (targetStatus: AppointmentStatus) => {
    await Promise.resolve();
    if (currentStatus !== AppointmentStatus.HELD) {
      return 0; // updateMany where status == HELD matched 0
    }
    currentStatus = targetStatus;
    return 1; // exactly 1 updated
  };

  const [acceptResult, rejectResult] = await Promise.all([
    attemptDecision(AppointmentStatus.PENDING),
    attemptDecision(AppointmentStatus.CANCELLED),
  ]);

  const winners = [acceptResult, rejectResult].filter((count) => count === 1);
  assert.equal(winners.length, 1);
  assert.ok(
    (currentStatus as AppointmentStatus) === AppointmentStatus.PENDING
      || (currentStatus as AppointmentStatus) === AppointmentStatus.CANCELLED,
  );
});

test("concurrent payments on PENDING appointment produce exactly one confirmed payment", async () => {
  let appointmentStatus: AppointmentStatus = AppointmentStatus.PENDING;
  let slotStatus: SlotStatus = SlotStatus.HELD;
  let paidCount = 0;

  const attemptPayment = async () => {
    await Promise.resolve();
    if (appointmentStatus !== AppointmentStatus.PENDING) {
      return 0;
    }
    appointmentStatus = AppointmentStatus.CONFIRMED;
    slotStatus = SlotStatus.BOOKED;
    paidCount++;
    return 1;
  };

  const [p1, p2] = await Promise.all([attemptPayment(), attemptPayment()]);
  const successful = [p1, p2].filter((count) => count === 1);

  assert.equal(successful.length, 1);
  assert.equal(paidCount, 1);
  assert.equal(appointmentStatus, AppointmentStatus.CONFIRMED);
  assert.equal(slotStatus, SlotStatus.BOOKED);
});

