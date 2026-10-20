import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
    AdminMedicineListQuery,
    CreateMedicineInput,
    UpdateMedicineInput,
} from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";
import { AppError } from "../../../shared/errors/AppError.js";

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

const getMedicineForAdmin = async (adminUserId: string, medicineId: string) => {
    await requireActiveAdmin(adminUserId);
    const medicine = await prisma.medicine.findUnique({
        where: { id: medicineId },
        select: medicineSelect,
    });
    if (!medicine) throw new AppError("Medicine not found", 404);
    return medicine;
};

const updateMedicineForAdmin = async (
    adminUserId: string,
    medicineId: string,
    input: UpdateMedicineInput,
) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const existing = await tx.medicine.findUnique({
            where: { id: medicineId },
            select: {
                name: true,
                description: true,
                requiresPrescription: true,
                inventory: {
                    select: { id: true, price: true, stockQuantity: true, isAvailable: true },
                },
            },
        });
        if (!existing) throw new AppError("Medicine not found", 404);

        const inventory = existing.inventory[0];
        const changesInventory = input.price !== undefined || input.stockQuantity !== undefined;
        if (changesInventory && !inventory) {
            throw new AppError("Medicine inventory not found", 409);
        }

        if (
            input.name !== undefined
            || input.description !== undefined
            || input.requiresPrescription !== undefined
        ) {
            await tx.medicine.update({
                where: { id: medicineId },
                data: {
                    ...(input.name !== undefined && { name: input.name }),
                    ...(input.description !== undefined && { description: input.description }),
                    ...(input.requiresPrescription !== undefined && {
                        requiresPrescription: input.requiresPrescription,
                    }),
                },
            });
        }

        if (changesInventory && inventory) {
            await tx.storeInventory.update({
                where: { id: inventory.id },
                data: {
                    ...(input.price !== undefined && { price: input.price }),
                    ...(input.stockQuantity !== undefined && {
                        stockQuantity: input.stockQuantity,
                        isAvailable: input.stockQuantity > 0,
                    }),
                },
            });
        }

        await tx.auditLog.create({
            data: {
                actorUserId: adminUserId,
                action: "MEDICINE_UPDATED",
                entityType: "Medicine",
                entityId: medicineId,
                before: {
                    name: existing.name,
                    description: existing.description,
                    requiresPrescription: existing.requiresPrescription,
                    price: inventory?.price.toString() ?? null,
                    stockQuantity: inventory?.stockQuantity ?? null,
                },
                after: input,
            },
        });

        return tx.medicine.findUniqueOrThrow({
            where: { id: medicineId },
            select: medicineSelect,
        });
    });
};

const deactivateMedicineForAdmin = async (adminUserId: string, medicineId: string) => {
    await requireActiveAdmin(adminUserId);

    return prisma.$transaction(async (tx) => {
        const medicine = await tx.medicine.findUnique({
            where: { id: medicineId },
            select: { id: true },
        });
        if (!medicine) throw new AppError("Medicine not found", 404);

        const deactivated = await tx.storeInventory.updateMany({
            where: { medicineId, isAvailable: true },
            data: { isAvailable: false },
        });

        if (deactivated.count > 0) {
            await tx.auditLog.create({
                data: {
                    actorUserId: adminUserId,
                    action: "MEDICINE_DEACTIVATED",
                    entityType: "Medicine",
                    entityId: medicineId,
                    before: { isAvailable: true },
                    after: { isAvailable: false },
                },
            });
        }

        return tx.medicine.findUniqueOrThrow({
            where: { id: medicineId },
            select: medicineSelect,
        });
    });
};

export const medicineService = {
    listMedicinesForAdmin,
    createMedicineForAdmin,
    getMedicineForAdmin,
    updateMedicineForAdmin,
    deactivateMedicineForAdmin,
};
