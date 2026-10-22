import assert from "node:assert/strict";
import test from "node:test";

import { AccountStatus, NotificationType, Prisma } from "../../../generated/prisma/client.js";
import { createNotificationIfEligible } from "../../notifications/services/notification.service.js";

type Recipient = { status: AccountStatus; deletedAt: Date | null };

const makeClient = (recipient: Recipient | null) => {
    const created: unknown[] = [];
    const client = {
        user: {
            findFirst: async ({ where }: { where: Record<string, unknown> }) => {
                if (!recipient) return null;
                if (where.status !== recipient.status || where.deletedAt !== recipient.deletedAt) {
                    return null;
                }
                return { id: "patient-user" };
            },
        },
        notification: {
            create: async (args: unknown) => {
                created.push(args);
                return args;
            },
        },
    } as unknown as Prisma.TransactionClient;

    return { client, created };
};

const input = {
    userId: "patient-user",
    title: "Order status updated",
    message: "Your medicine order status is now PROCESSING.",
    notificationType: NotificationType.ORDER,
    relatedEntityType: "Order",
    relatedEntityId: "00000000-0000-0000-0000-000000000001",
};

test("creates an order notification for an active recipient", async () => {
    const { client, created } = makeClient({ status: AccountStatus.ACTIVE, deletedAt: null });

    const result = await createNotificationIfEligible(input, client);

    assert.ok(result);
    assert.equal(created.length, 1);
});

test("skips an order notification for a suspended recipient", async () => {
    const { client, created } = makeClient({ status: AccountStatus.SUSPENDED, deletedAt: null });

    const result = await createNotificationIfEligible(input, client);

    assert.equal(result, null);
    assert.equal(created.length, 0);
});

test("skips an order notification for a soft-deleted recipient", async () => {
    const { client, created } = makeClient({
        status: AccountStatus.ACTIVE,
        deletedAt: new Date("2026-10-21T00:00:00.000Z"),
    });

    const result = await createNotificationIfEligible(input, client);

    assert.equal(result, null);
    assert.equal(created.length, 0);
});

test("skips an order notification for a rejected recipient", async () => {
    const { client, created } = makeClient({ status: AccountStatus.REJECTED, deletedAt: null });

    const result = await createNotificationIfEligible(input, client);

    assert.equal(result, null);
    assert.equal(created.length, 0);
});
