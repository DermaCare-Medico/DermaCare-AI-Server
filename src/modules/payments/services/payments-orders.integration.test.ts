import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, before, test } from "node:test";

import { prisma } from "../../../lib/prisma.js";
import { orderService } from "../../orders/services/order.service.js";
import { paymentService } from "./payment.service.js";

if (process.env.RUN_PAYMENTS_DB_INTEGRATION !== "1") {
  test.skip("Payment database integration tests require RUN_PAYMENTS_DB_INTEGRATION=1", () => {});
  process.exit(0);
}

const runTag = `payments-orders-it-${crypto.randomUUID()}`;
const email = (label: string) => `${runTag}-${label}@example.test`;
const fixtureEmails = [email("patient-a"), email("patient-b"), email("doctor"), email("admin")];

let patientA!: { userId: string; profileId: string };
let patientB!: { userId: string; profileId: string };
let doctor!: { userId: string; profileId: string };
let adminUserId!: string;

const createPatient = async (address: string) => {
  const user = await prisma.user.create({
    data: {
      name: runTag,
      email: address,
      role: "PATIENT",
      status: "ACTIVE",
      emailVerified: true,
      patientProfile: { create: {} },
    },
    select: { id: true, patientProfile: { select: { id: true } } },
  });
  return { userId: user.id, profileId: user.patientProfile!.id };
};

const createInventory = async (label: string, stockQuantity: number, price = "10.00") => {
  const medicine = await prisma.medicine.create({
    data: {
      name: `${runTag}-${label}`,
      isVerified: true,
      requiresPrescription: false,
      inventory: {
        create: { price, stockQuantity, isAvailable: true },
      },
    },
    select: { id: true, inventory: { select: { id: true } } },
  });
  return { medicineId: medicine.id, inventoryId: medicine.inventory!.id };
};

const waitForMeetingWorker = async (appointmentId: string) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { meetingProvisioningStatus: true },
    });
    if (!appointment || appointment.meetingProvisioningStatus !== "PROCESSING") return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Meet worker did not release the test appointment lock");
};

before(async () => {
  assert.equal(
    await prisma.user.count({ where: { email: { in: fixtureEmails } } }),
    0,
    "unique integration fixture tag collided with existing users",
  );

  patientA = await createPatient(fixtureEmails[0]!);
  patientB = await createPatient(fixtureEmails[1]!);

  const specialization = await prisma.specialization.create({
    data: { name: runTag },
  });
  const doctorUser = await prisma.user.create({
    data: {
      name: runTag,
      email: fixtureEmails[2]!,
      role: "DOCTOR",
      status: "ACTIVE",
      emailVerified: true,
      doctorProfile: {
        create: {
          licenseNumber: runTag,
          consultationFee: "500.00",
          approvalStatus: "APPROVED",
          approvedAt: new Date(),
          specializations: {
            create: { specializationId: specialization.id },
          },
        },
      },
    },
    select: { id: true, doctorProfile: { select: { id: true } } },
  });
  doctor = { userId: doctorUser.id, profileId: doctorUser.doctorProfile!.id };

  const admin = await prisma.user.create({
    data: {
      name: runTag,
      email: fixtureEmails[3]!,
      role: "ADMIN",
      status: "ACTIVE",
      emailVerified: true,
    },
  });
  adminUserId = admin.id;
});

after(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: fixtureEmails } },
    select: { id: true, patientProfile: { select: { id: true } }, doctorProfile: { select: { id: true } } },
  });
  const userIds = users.map(({ id }) => id);
  const patientIds = users.flatMap(({ patientProfile }) => patientProfile ? [patientProfile.id] : []);
  const doctorIds = users.flatMap(({ doctorProfile }) => doctorProfile ? [doctorProfile.id] : []);
  const appointments = await prisma.appointment.findMany({
    where: { OR: [{ patientId: { in: patientIds } }, { doctorId: { in: doctorIds } }] },
    select: { id: true, slotId: true },
  });
  const orders = await prisma.order.findMany({
    where: { patientId: { in: patientIds } },
    select: { id: true },
  });
  const medicines = await prisma.medicine.findMany({
    where: { name: { startsWith: runTag } },
    select: { id: true, inventory: { select: { id: true } } },
  });
  const appointmentIds = appointments.map(({ id }) => id);
  const orderIds = orders.map(({ id }) => id);
  const entityIds = [...appointmentIds, ...orderIds];

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { relatedEntityId: { in: entityIds } }] },
    });
    await tx.paymentTransaction.deleteMany({
      where: { OR: [{ appointmentId: { in: appointmentIds } }, { orderId: { in: orderIds } }] },
    });
    await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    await tx.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    await tx.doctorSlot.deleteMany({ where: { id: { in: appointments.map(({ slotId }) => slotId) } } });
    await tx.storeInventory.deleteMany({
      where: { id: { in: medicines.flatMap(({ inventory }) => inventory ? [inventory.id] : []) } },
    });
    await tx.medicine.deleteMany({ where: { id: { in: medicines.map(({ id }) => id) } } });
    await tx.doctorProfile.deleteMany({ where: { id: { in: doctorIds } } });
    await tx.patientProfile.deleteMany({ where: { id: { in: patientIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
    await tx.specialization.deleteMany({ where: { name: runTag } });
  });
  await prisma.$disconnect();
});

test("concurrent appointment payments have exactly one winner and consistent notifications", async () => {
  const slot = await prisma.doctorSlot.create({
    data: {
      doctorId: doctor.profileId,
      startTime: new Date(Date.now() + 24 * 60 * 60_000),
      endTime: new Date(Date.now() + 25 * 60 * 60_000),
    },
  });
  const appointment = await prisma.appointment.create({
    data: {
      patientId: patientA.profileId,
      doctorId: doctor.profileId,
      slotId: slot.id,
      status: "PENDING",
    },
  });

  const results = await Promise.allSettled([
    paymentService.payForAppointment(patientA.userId, appointment.id),
    paymentService.payForAppointment(patientA.userId, appointment.id),
  ]);
  await waitForMeetingWorker(appointment.id);

  const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
  const payments = await prisma.paymentTransaction.count({ where: { appointmentId: appointment.id } });
  const notifications = await prisma.notification.count({
    where: { relatedEntityType: "Appointment", relatedEntityId: appointment.id },
  });
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(stored.status, "CONFIRMED");
  assert.equal(payments, 1);
  assert.equal(notifications, 2);
});

test("concurrent medicine-order payments have exactly one winner", async () => {
  const inventory = await createInventory("payment", 5);
  const order = await orderService.createOrder(patientA.userId, {
    deliveryAddress: "Integration test delivery address",
    items: [{ medicineId: inventory.medicineId, quantity: 2 }],
  });

  const results = await Promise.allSettled([
    paymentService.payForOrder(patientA.userId, order.id, { amount: 20, currency: "BDT" }),
    paymentService.payForOrder(patientA.userId, order.id, { amount: 20, currency: "BDT" }),
  ]);

  const storedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const storedInventory = await prisma.storeInventory.findUniqueOrThrow({ where: { id: inventory.inventoryId } });
  const payments = await prisma.paymentTransaction.count({ where: { orderId: order.id } });
  const patientNotifications = await prisma.notification.count({
    where: { userId: patientA.userId, relatedEntityType: "Order", relatedEntityId: order.id },
  });
  const adminNotifications = await prisma.notification.count({
    where: { userId: adminUserId, relatedEntityType: "Order", relatedEntityId: order.id },
  });
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(storedOrder.status, "CONFIRMED");
  assert.equal(storedInventory.stockQuantity, 3);
  assert.equal(payments, 1);
  assert.equal(patientNotifications, 1);
  assert.equal(adminNotifications, 1);
});

test("concurrent orders competing for limited inventory do not oversell", async () => {
  const inventory = await createInventory("limited", 3);
  const input = {
    deliveryAddress: "Integration test delivery address",
    items: [{ medicineId: inventory.medicineId, quantity: 2 }],
  };

  const results = await Promise.allSettled([
    orderService.createOrder(patientA.userId, input),
    orderService.createOrder(patientB.userId, input),
  ]);

  const storedInventory = await prisma.storeInventory.findUniqueOrThrow({ where: { id: inventory.inventoryId } });
  const orders = await prisma.order.count({
    where: { items: { some: { inventoryId: inventory.inventoryId } } },
  });
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(storedInventory.stockQuantity, 1);
  assert.equal(orders, 1);
});

test("expired unpaid order cancellation restores stock exactly once", async () => {
  const inventory = await createInventory("expired", 4);
  const order = await orderService.createOrder(patientA.userId, {
    deliveryAddress: "Integration test delivery address",
    items: [{ medicineId: inventory.medicineId, quantity: 3 }],
  });
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentExpiresAt: new Date(Date.now() - 1_000) },
  });

  const first = await orderService.cleanupExpiredUnpaidOrders();
  const second = await orderService.cleanupExpiredUnpaidOrders();

  const storedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const storedInventory = await prisma.storeInventory.findUniqueOrThrow({ where: { id: inventory.inventoryId } });
  assert.equal(first, 1);
  assert.equal(second, 0);
  assert.equal(storedOrder.status, "CANCELLED");
  assert.equal(storedInventory.stockQuantity, 4);
});

test("expiry cleanup leaves a paid order and its reserved stock unchanged", async () => {
  const inventory = await createInventory("paid-expired", 4);
  const order = await orderService.createOrder(patientA.userId, {
    deliveryAddress: "Integration test delivery address",
    items: [{ medicineId: inventory.medicineId, quantity: 3 }],
  });
  await paymentService.payForOrder(patientA.userId, order.id, { amount: 30, currency: "BDT" });
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentExpiresAt: new Date(Date.now() - 1_000) },
  });

  const cancelled = await orderService.cleanupExpiredUnpaidOrders();

  const storedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const storedInventory = await prisma.storeInventory.findUniqueOrThrow({ where: { id: inventory.inventoryId } });
  assert.equal(cancelled, 0);
  assert.equal(storedOrder.status, "CONFIRMED");
  assert.equal(storedInventory.stockQuantity, 1);
});
