import {
    AccountStatus,
    OrderStatus,
    Prisma,
    Role,
    NotificationType,
} from "../../../generated/prisma/client.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { prisma } from "../../../lib/prisma.js";
import type {
    AdminOrderListQuery,
    AdminOrderStatusInput,
} from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";
import type {
    CreateOrderInput,
    PatientOrderListQuery,
} from "../orders.validation.js";
import {
    aggregateInventoryQuantities,
    getOrderPaymentExpiry,
} from "./order-payment.rules.js";
import { getAllowedOrderTransitions } from "./order-status.rules.js";
import {
    createNotification,
    createNotificationIfEligible,
} from "../../notifications/services/notification.service.js";

const getActivePatient = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.PATIENT,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { patientProfile: { select: { id: true } } },
    });
    if (!user) throw new AppError("Only active patients may access orders", 403);
    if (!user.patientProfile) throw new AppError("Patient profile not found", 404);
    return user.patientProfile;
};

const createOrder = async (userId: string, input: CreateOrderInput) => {
    const patient = await getActivePatient(userId);

    try {
        return await prisma.$transaction(async (tx) => {
            const medicineIds = input.items.map((item) => item.medicineId);
            const inventories = await tx.storeInventory.findMany({
                where: {
                    medicineId: { in: medicineIds },
                    isAvailable: true,
                    medicine: { isVerified: true },
                },
                select: {
                    id: true,
                    medicineId: true,
                    price: true,
                    stockQuantity: true,
                    medicine: {
                        select: {
                            name: true,
                            strength: true,
                            requiresPrescription: true,
                        },
                    },
                },
            });

            if (inventories.length !== input.items.length) {
                throw new AppError("One or more medicines are unavailable", 400);
            }

            const inventoryByMedicine = new Map(
                inventories.map((inventory) => [inventory.medicineId, inventory]),
            );
            const prescription = input.prescriptionId
                ? await tx.prescription.findFirst({
                    where: {
                        id: input.prescriptionId,
                        sentAt: { not: null },
                        appointment: { patientId: patient.id },
                    },
                    select: { items: { select: { medicineId: true } } },
                })
                : null;

            if (input.prescriptionId && !prescription) {
                throw new AppError("Prescription not found", 404);
            }
            const prescribedMedicineIds = new Set(
                prescription?.items.map((item) => item.medicineId) ?? [],
            );

            const orderItems = input.items.map((item) => {
                const inventory = inventoryByMedicine.get(item.medicineId)!;
                if (
                    inventory.medicine.requiresPrescription
                    && !prescribedMedicineIds.has(item.medicineId)
                ) {
                    throw new AppError(
                        `${inventory.medicine.name} requires an eligible prescription`,
                        400,
                    );
                }
                if (inventory.stockQuantity < item.quantity) {
                    throw new AppError(`Insufficient stock for ${inventory.medicine.name}`, 409);
                }

                return {
                    inventoryId: inventory.id,
                    medicineName: inventory.medicine.name,
                    medicineStrength: inventory.medicine.strength,
                    quantity: item.quantity,
                    unitPrice: inventory.price,
                    subtotal: inventory.price.mul(item.quantity),
                };
            });

            for (const item of orderItems) {
                const deducted = await tx.storeInventory.updateMany({
                    where: {
                        id: item.inventoryId,
                        isAvailable: true,
                        stockQuantity: { gte: item.quantity },
                    },
                    data: { stockQuantity: { decrement: item.quantity } },
                });
                if (deducted.count !== 1) {
                    throw new AppError(`Insufficient stock for ${item.medicineName}`, 409);
                }
            }

            const totalAmount = orderItems.reduce(
                (total, item) => total.add(item.subtotal),
                new Prisma.Decimal(0),
            );
            const paymentExpiresAt = getOrderPaymentExpiry();

            const order = await tx.order.create({
                data: {
                    patientId: patient.id,
                    prescriptionId: input.prescriptionId,
                    deliveryAddress: input.deliveryAddress,
                    totalAmount,
                    paymentExpiresAt,
                    items: { create: orderItems },
                },
                select: {
                    id: true,
                    status: true,
                    prescriptionId: true,
                    totalAmount: true,
                    deliveryAddress: true,
                    paymentExpiresAt: true,
                    createdAt: true,
                    items: {
                        select: {
                            id: true,
                            medicineName: true,
                            medicineStrength: true,
                            quantity: true,
                            unitPrice: true,
                            subtotal: true,
                        },
                    },
                },
            });

            const admins = await tx.user.findMany({
                where: {
                    role: Role.ADMIN,
                    status: AccountStatus.ACTIVE,
                    deletedAt: null,
                },
                select: { id: true },
            });
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    title: "New medicine order",
                    message: "A new medicine order has been placed and is awaiting payment.",
                    notificationType: NotificationType.ORDER,
                    relatedEntityType: "Order",
                    relatedEntityId: order.id,
                }, tx);
            }

            return order;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
            throw new AppError("Stock changed while placing the order; please retry", 409);
        }
        throw error;
    }
};

const listMyOrders = async (userId: string, query: PatientOrderListQuery) => {
    const patient = await getActivePatient(userId);
    const where: Prisma.OrderWhereInput = {
        patientId: patient.id,
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
                status: true,
                prescriptionId: true,
                totalAmount: true,
                paymentExpiresAt: true,
                createdAt: true,
                updatedAt: true,
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

const getMyOrder = async (userId: string, orderId: string) => {
    const patient = await getActivePatient(userId);
    const order = await prisma.order.findFirst({
        where: { id: orderId, patientId: patient.id },
        select: {
            id: true,
            status: true,
            prescriptionId: true,
            totalAmount: true,
            paymentExpiresAt: true,
            deliveryAddress: true,
            createdAt: true,
            updatedAt: true,
            items: {
                select: {
                    id: true,
                    medicineName: true,
                    medicineStrength: true,
                    quantity: true,
                    unitPrice: true,
                    subtotal: true,
                },
            },
        },
    });
    if (!order) throw new AppError("Order not found", 404);
    return order;
};

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
    paymentExpiresAt: true,
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
            medicineStrength: true,
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
                totalAmount: true,
                patient: { select: { userId: true } },
                items: { select: { inventoryId: true, quantity: true } },
                payments: {
                    where: {
                        purpose: "MEDICINE_ORDER",
                        status: "PAID",
                    },
                    select: { id: true, amount: true, currency: true },
                    take: 1,
                },
            },
        });
        if (!existing) throw new AppError("Order not found", 404);
        if (!getAllowedOrderTransitions(existing.status).includes(input.status)) {
            throw new AppError(
                `Order cannot transition from ${existing.status} to ${input.status}`,
                409,
            );
        }
        const paidPayment = existing.payments[0];
        if (input.status === OrderStatus.CONFIRMED
            && (!paidPayment
                || !paidPayment.amount.equals(existing.totalAmount)
                || paidPayment.currency !== "BDT")) {
            throw new AppError("Order must be paid in full before confirmation", 409);
        }

        const updated = await tx.order.updateMany({
            where: {
                id: orderId,
                status: existing.status,
                ...(input.status === OrderStatus.CONFIRMED && {
                    payments: { some: { id: paidPayment!.id } },
                }),
            },
            data: { status: input.status },
        });
        if (updated.count !== 1) throw new AppError("Order status changed; please retry", 409);

        if (input.status === OrderStatus.CANCELLED) {
            const quantitiesByInventory = aggregateInventoryQuantities(existing.items);

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

        await createNotificationIfEligible({
            userId: existing.patient.userId,
            title: "Order status updated",
            message: `Your medicine order status is now ${input.status}.`,
            notificationType: NotificationType.ORDER,
            relatedEntityType: "Order",
            relatedEntityId: orderId,
        }, tx);

        return tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: orderDetailsSelect,
        });
    });
};

const cleanupExpiredUnpaidOrders = async (now = new Date(), batchSize = 100) => {
    const candidates = await prisma.order.findMany({
        where: {
            status: OrderStatus.PENDING,
            paymentExpiresAt: { lte: now },
            payments: {
                none: {
                    purpose: "MEDICINE_ORDER",
                    status: "PAID",
                },
            },
        },
        orderBy: { paymentExpiresAt: "asc" },
        take: batchSize,
        select: { id: true },
    });

    let cancelled = 0;
    for (const candidate of candidates) {
        const didCancel = await prisma.$transaction(async (tx) => {
            const order = await tx.order.findUnique({
                where: { id: candidate.id },
                select: { items: { select: { inventoryId: true, quantity: true } } },
            });
            if (!order) return false;

            const claimed = await tx.order.updateMany({
                where: {
                    id: candidate.id,
                    status: OrderStatus.PENDING,
                    paymentExpiresAt: { lte: now },
                    payments: {
                        none: {
                            purpose: "MEDICINE_ORDER",
                            status: "PAID",
                        },
                    },
                },
                data: { status: OrderStatus.CANCELLED },
            });
            if (claimed.count !== 1) return false;

            for (const [inventoryId, quantity] of aggregateInventoryQuantities(order.items)) {
                await tx.storeInventory.update({
                    where: { id: inventoryId },
                    data: { stockQuantity: { increment: quantity } },
                });
            }
            return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        if (didCancel) cancelled += 1;
    }
    return cancelled;
};

export const orderService = {
    createOrder,
    listMyOrders,
    getMyOrder,
    listOrdersForAdmin,
    getOrderForAdmin,
    updateOrderStatusForAdmin,
    cleanupExpiredUnpaidOrders,
};
