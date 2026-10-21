import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregateInventoryQuantities,
    getOrderPaymentExpiry,
    isOrderPaymentExpired,
    isMatchingOrderPayment,
    ORDER_PAYMENT_WINDOW_MS,
} from "./order-payment.rules.js";
import { OrderStatus } from "../../../generated/prisma/enums.js";
import { getAllowedOrderTransitions } from "./order-status.rules.js";

test("order payment expires exactly 30 minutes after creation", () => {
    const createdAt = new Date("2026-10-20T00:00:00.000Z");
    const expiresAt = getOrderPaymentExpiry(createdAt);

    assert.equal(expiresAt.getTime() - createdAt.getTime(), ORDER_PAYMENT_WINDOW_MS);
    assert.equal(isOrderPaymentExpired(expiresAt, new Date(expiresAt.getTime() - 1)), false);
    assert.equal(isOrderPaymentExpired(expiresAt, expiresAt), true);
});

test("order payment requires the exact amount and BDT currency", () => {
    const amount = { equals: (value: unknown) => Number(value) === 1250.5 };

    assert.equal(isMatchingOrderPayment(amount, 1250.5, "BDT"), true);
    assert.equal(isMatchingOrderPayment(amount, 1250.49, "BDT"), false);
    assert.equal(isMatchingOrderPayment(amount, 1250.5, "USD"), false);
});

test("a guarded pending-order claim has exactly one winner", async () => {
    let status: "PENDING" | "CONFIRMED" = "PENDING";
    const claim = async () => {
        await Promise.resolve();
        if (status !== "PENDING") return 0;
        status = "CONFIRMED";
        return 1;
    };

    const claims = await Promise.all([claim(), claim()]);
    assert.equal(claims.filter((count) => count === 1).length, 1);
});

test("stock restoration aggregates repeated inventory rows exactly once", () => {
    const quantities = aggregateInventoryQuantities([
        { inventoryId: "inventory-a", quantity: 2 },
        { inventoryId: "inventory-b", quantity: 1 },
        { inventoryId: "inventory-a", quantity: 3 },
    ]);

    assert.deepEqual([...quantities], [
        ["inventory-a", 5],
        ["inventory-b", 1],
    ]);
});

test("paid orders follow every required fulfillment stage in order", () => {
    assert.deepEqual(getAllowedOrderTransitions(OrderStatus.CONFIRMED), [
        OrderStatus.PROCESSING,
        OrderStatus.CANCELLED,
    ]);
    assert.deepEqual(getAllowedOrderTransitions(OrderStatus.PROCESSING), [
        OrderStatus.PACKED,
        OrderStatus.CANCELLED,
    ]);
    assert.deepEqual(getAllowedOrderTransitions(OrderStatus.PACKED), [
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.CANCELLED,
    ]);
    assert.deepEqual(getAllowedOrderTransitions(OrderStatus.OUT_FOR_DELIVERY), [
        OrderStatus.DELIVERED,
    ]);
    assert.deepEqual(getAllowedOrderTransitions(OrderStatus.DELIVERED), []);
});
