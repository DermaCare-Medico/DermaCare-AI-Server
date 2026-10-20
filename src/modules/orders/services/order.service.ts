import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type { AdminOrderListQuery } from "../../admin/admin.validation.js";
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

export const orderService = { listOrdersForAdmin };
