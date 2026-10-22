import assert from "node:assert/strict";
import test from "node:test";
import { SlotStatus } from "../../../generated/prisma/client.js";
import { isDiscoverableDoctorSlot, slotsOverlap } from "./doctor-slot.rules.js";

const now = new Date("2026-10-21T10:00:00.000Z");

test("discovery returns only available future slots", () => {
  assert.equal(isDiscoverableDoctorSlot({ status: SlotStatus.AVAILABLE, startTime: new Date("2026-10-21T11:00:00Z") }, now), true);
  for (const status of [SlotStatus.HELD, SlotStatus.BOOKED, SlotStatus.UNAVAILABLE]) {
    assert.equal(isDiscoverableDoctorSlot({ status, startTime: new Date("2026-10-21T11:00:00Z") }, now), false);
  }
  assert.equal(isDiscoverableDoctorSlot({ status: SlotStatus.AVAILABLE, startTime: now }, now), false);
  assert.equal(isDiscoverableDoctorSlot({ status: SlotStatus.AVAILABLE, startTime: new Date("2026-10-21T09:00:00Z") }, now), false);
});

test("overlap rule catches intersecting slots but permits adjacent slots", () => {
  const existing = { startTime: new Date("2026-10-21T11:00:00Z"), endTime: new Date("2026-10-21T11:30:00Z") };
  assert.equal(slotsOverlap(existing, { startTime: new Date("2026-10-21T11:15:00Z"), endTime: new Date("2026-10-21T11:45:00Z") }), true);
  assert.equal(slotsOverlap(existing, { startTime: new Date("2026-10-21T11:30:00Z"), endTime: new Date("2026-10-21T12:00:00Z") }), false);
});
