import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type {
    AdminMedicineListQuery,
    CreateMedicineInput,
    UpdateMedicineInput,
} from "../../admin/admin.validation.js";
import { requireActiveAdmin } from "../../admin/services/admin.service.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { PublicMedicineListQuery } from "../stores.validation.js";

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

const publicMedicineSelect = {
    id: true,
    name: true,
    description: true,
    requiresPrescription: true,
    inventory: {
        where: { isAvailable: true, stockQuantity: { gt: 0 } },
        take: 1,
        select: { price: true, stockQuantity: true },
    },
} satisfies Prisma.MedicineSelect;

type PublicMedicineRecord = Prisma.MedicineGetPayload<{
    select: typeof publicMedicineSelect;
}>;

const presentPublicMedicine = (medicine: PublicMedicineRecord) => ({
    id: medicine.id,
    name: medicine.name,
    description: medicine.description,
    requiresPrescription: medicine.requiresPrescription,
    price: medicine.inventory[0]!.price,
    stockQuantity: medicine.inventory[0]!.stockQuantity,
});

const publicMedicineWhere = (search?: string): Prisma.MedicineWhereInput => ({
    isVerified: true,
    inventory: { some: { isAvailable: true, stockQuantity: { gt: 0 } } },
    ...(search && {
        OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
        ],
    }),
});

const listPublicMedicines = async (query: PublicMedicineListQuery) => {
    const where = publicMedicineWhere(query.search);
    const [medicines, total] = await prisma.$transaction([
        prisma.medicine.findMany({
            where,
            select: publicMedicineSelect,
            orderBy: { name: "asc" },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
        prisma.medicine.count({ where }),
    ]);

    return {
        medicines: medicines.map(presentPublicMedicine),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
};

const getPublicMedicine = async (medicineId: string) => {
    const medicine = await prisma.medicine.findFirst({
        where: { id: medicineId, ...publicMedicineWhere() },
        select: publicMedicineSelect,
    });
    if (!medicine) throw new AppError("Medicine not found", 404);
    return presentPublicMedicine(medicine);
};

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
        inventory: {
            some: {
                ...(query.isAvailable !== undefined && {
                    isAvailable: query.isAvailable,
                }),
                ...(query.lowStock !== undefined && {
                    stockQuantity: query.lowStock
                        ? { lte: LOW_STOCK_MAXIMUM }
                        : { gt: LOW_STOCK_MAXIMUM },
                }),
            },
        },
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
        const changesInventory = input.price !== undefined
            || input.stockQuantity !== undefined
            || input.isAvailable !== undefined;
        if (changesInventory && !inventory) {
            throw new AppError("Medicine inventory not found", 409);
        }

        const effectiveStock = input.stockQuantity ?? inventory?.stockQuantity ?? 0;
        if (input.isAvailable === true && effectiveStock <= 0) {
            throw new AppError("Medicine cannot be activated without stock", 400);
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
                    }),
                    ...(input.isAvailable !== undefined && {
                        isAvailable: input.isAvailable,
                    }),
                    ...(input.stockQuantity === 0 && { isAvailable: false }),
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
                    isAvailable: inventory?.isAvailable ?? null,
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
    listPublicMedicines,
    getPublicMedicine,
    listMedicinesForAdmin,
    createMedicineForAdmin,
    getMedicineForAdmin,
    updateMedicineForAdmin,
    deactivateMedicineForAdmin,
};
