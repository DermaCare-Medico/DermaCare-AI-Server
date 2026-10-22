import assert from "node:assert/strict";
import test from "node:test";

import {
  AccountStatus,
  NotificationType,
  Prisma,
} from "../../../generated/prisma/client.js";
import { createNotificationIfEligible } from "./notification.service.js";

function transactionFor(status: AccountStatus, deletedAt: Date | null = null) {
  const created: unknown[] = [];
  const transaction = {
    user: {
      findFirst: async () => status === AccountStatus.ACTIVE && deletedAt === null
        ? { id: "patient-user" }
        : null,
    },
    notification: {
      create: async (args: unknown) => {
        created.push(args);
        return args;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { transaction, created };
}

const notification = {
  userId: "patient-user",
  title: "Consultation completed",
  message: "Your consultation has been marked as completed.",
  notificationType: NotificationType.APPOINTMENT,
  relatedEntityType: "Appointment",
  relatedEntityId: "appointment-id",
};

test("lifecycle notification is created for an eligible Patient", async () => {
  const { transaction, created } = transactionFor(AccountStatus.ACTIVE);

  const result = await createNotificationIfEligible(notification, transaction);

  assert.ok(result);
  assert.equal(created.length, 1);
});

test("suspended Patient does not block a lifecycle transaction", async () => {
  const { transaction, created } = transactionFor(AccountStatus.SUSPENDED);

  const result = await createNotificationIfEligible(notification, transaction);

  assert.equal(result, null);
  assert.equal(created.length, 0);
});

test("soft-deleted Patient does not block a lifecycle transaction", async () => {
  const { transaction, created } = transactionFor(AccountStatus.ACTIVE, new Date());

  const result = await createNotificationIfEligible(notification, transaction);

  assert.equal(result, null);
  assert.equal(created.length, 0);
});
