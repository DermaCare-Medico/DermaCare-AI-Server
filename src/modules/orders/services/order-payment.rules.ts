export const ORDER_PAYMENT_WINDOW_MS = 30 * 60 * 1000;

export const getOrderPaymentExpiry = (createdAt = new Date()) =>
    new Date(createdAt.getTime() + ORDER_PAYMENT_WINDOW_MS);

export const isOrderPaymentExpired = (paymentExpiresAt: Date, now = new Date()) =>
    paymentExpiresAt.getTime() <= now.getTime();

export const isMatchingOrderPayment = (
    orderAmount: { equals(value: unknown): boolean },
    paymentAmount: unknown,
    currency: string,
) => currency === "BDT" && orderAmount.equals(paymentAmount);

export const aggregateInventoryQuantities = (
    items: ReadonlyArray<{ inventoryId: string; quantity: number }>,
) => items.reduce<Map<string, number>>((quantities, item) => {
    quantities.set(
        item.inventoryId,
        (quantities.get(item.inventoryId) ?? 0) + item.quantity,
    );
    return quantities;
}, new Map());
