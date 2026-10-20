import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
    AdminMedicineListQuery,
    CreateMedicineInput,
} from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";

const LOW_STOCK_MAXIMUM = 10;

const medicineSelect = {
    id: true,
    name: true,
    description: true,
    requiresPrescription: true,
    isVerified: true,
    verifiedAt: true,
    createdAt: true,
    updatedAt: true,
    inventory: {
        select: {
            id: true,
            price: true,
            stockQuantity: true,
            isAvailable: true,
            updatedAt: true,
        },
    },
} satisfies Prisma.MedicineSelect;

const listMedicinesForAdmin = async (
    adminUserId: string,
    query: AdminMedicineListQuery,
) => {
    await requireActiveAdmin(adminUserId);
    const where: Prisma.MedicineWhereInput = {
        ...(query.search && {
            OR: [
                { name: { contains: query.search, mode: "insensitive" } },
                { description: { contains: query.search, mode: "insensitive" } },
            ],
        }),
        ...(query.lowStock !== undefined && {
            inventory: query.lowStock
                ? { some: { stockQuantity: { lte: LOW_STOCK_MAXIMUM } } }
                : { some: { stockQuantity: { gt: LOW_STOCK_MAXIMUM } } },
        }),
    };

    const [medicines, total] = await prisma.$transaction([
        prisma.medicine.findMany({
            where,
            select: medicineSelect,
            orderBy: { createdAt: "desc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.medicine.count({ where }),
    ]);

    return {
        medicines,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const createMedicineForAdmin = async (adminUserId: string, input: CreateMedicineInput) => {
    await requireActiveAdmin(adminUserId);
    return prisma.$transaction(async (tx) => {
        const medicine = await tx.medicine.create({
            data: {
                name: input.name,
                description: input.description,
                requiresPrescription: input.requiresPrescription,
                isVerified: true,
                verifiedById: adminUserId,
                verifiedAt: new Date(),
                inventory: {
                    create: {
                        price: input.price,
                        stockQuantity: input.stockQuantity,
                        isAvailable: input.stockQuantity > 0,
                    },
                },
            },
            select: medicineSelect,
        });

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "MEDICINE_CREATED",
                entityType: "Medicine",
                entityId: medicine.id,
                after: {
                    name: input.name,
                    price: input.price,
                    stockQuantity: input.stockQuantity,
                    requiresPrescription: input.requiresPrescription,
                },
            },
        });
        return medicine;
    });
};

export const medicineService = { listMedicinesForAdmin, createMedicineForAdmin };
