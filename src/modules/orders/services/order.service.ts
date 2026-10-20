import { OrderStatus, Prisma } from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { prisma } from "../../../lib/prisma.js";
import type {
    AdminOrderListQuery,
    AdminOrderStatusInput,
} from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";

const listOrdersForAdmin = async (adminUserId: string, query: AdminOrderListQuery) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.OrderWhereInput = {
        ...(query.status && { status: query.status }),
    };

    const [orders, total] = await prisma.$transaction([
        prisma.order.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                prescriptionId: true,
                status: true,
                totalAmount: true,
                createdAt: true,
                updatedAt: true,
                patient: {
                    select: {
                        id: true,
                        user: { select: { id: true, name: true, email: true } },
                    },
                },
                _count: { select: { items: true } },
            },
        }),
        prisma.order.count({ where }),
    ]);

    return {
        orders,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const orderDetailsSelect = {
    id: true,
    prescriptionId: true,
    status: true,
    totalAmount: true,
    deliveryAddress: true,
    createdAt: true,
    updatedAt: true,
    patient: {
        select: {
            id: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
        },
    },
    items: {
        select: {
            id: true,
            medicineName: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
        },
    },
    payments: {
        select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            provider: true,
            paidAt: true,
        },
        orderBy: { createdAt: "desc" as const },
    },
} satisfies Prisma.OrderSelect;

const getOrderForAdmin = async (adminUserId: string, orderId: string) => {
    await requireActiveAdmin(adminUserId);
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: orderDetailsSelect,
    });

    if (!order) throw new AppError("Order not found", 404);
    return order;
};

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [],
    [OrderStatus.CANCELLED]: [],
};

const updateOrderStatusForAdmin = async (
    adminUserId: string,
    orderId: string,
    input: AdminOrderStatusInput,
) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.order.findUnique({
            where: { id: orderId },
            select: {
                status: true,
                items: { select: { inventoryId: true, quantity: true } },
            },
        });
        if (!existing) throw new AppError("Order not found", 404);
        if (!allowedTransitions[existing.status].includes(input.status)) {
            throw new AppError(
                `Order cannot transition from ${existing.status} to ${input.status}`,
                409,
            );
        }

        const updated = await tx.order.updateMany({
            where: { id: orderId, status: existing.status },
            data: { status: input.status },
        });
        if (updated.count !== 1) throw new AppError("Order status changed; please retry", 409);

        if (input.status === OrderStatus.CANCELLED) {
            const quantitiesByInventory = existing.items.reduce<Map<string, number>>(
                (quantities, item) => {
                    quantities.set(
                        item.inventoryId,
                        (quantities.get(item.inventoryId) ?? 0) + item.quantity,
                    );
                    return quantities;
                },
                new Map(),
            );

            for (const [inventoryId, quantity] of quantitiesByInventory) {
                await tx.storeInventory.update({
                    where: { id: inventoryId },
                    data: { stockQuantity: { increment: quantity } },
                });
            }
        }

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "ADMIN_ORDER_STATUS_UPDATED",
                entityType: "Order",
                entityId: orderId,
                before: { status: existing.status },
                after: { status: input.status },
                ...(input.reason && { metadata: { reason: input.reason } }),
            },
        });

        return tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: orderDetailsSelect,
        });
    });
};

export const orderService = {
    listOrdersForAdmin,
    getOrderForAdmin,
    updateOrderStatusForAdmin,
};
