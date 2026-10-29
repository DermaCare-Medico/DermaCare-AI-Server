import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

export type CartItemResponse = {
    id: string;
    medicineId: string;
    name: string;
    strength: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    stockQuantity: number;
    requiresPrescription: boolean;
    prescriptionId: string | null;
    prescriptionVerified: boolean;
};

export type CartResponse = {
    cartId: string;
    items: CartItemResponse[];
    subtotal: number;
    shipping: number;
    total: number;
    eligibleForCheckout: boolean;
};

type RawCartItemRow = {
    id: string;
    patient_id: string;
    medicine_id: string;
    prescription_id: string | null;
    quantity: number;
    created_at: Date;
    updated_at: Date;
    name: string;
    strength: string | null;
    requires_prescription: boolean;
    price: string | number;
    stock_quantity: number;
    is_available: boolean;
};

const getActivePatientId = async (userId: string): Promise<string> => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: "PATIENT",
            status: "ACTIVE",
            deletedAt: null,
        },
        select: { patientProfile: { select: { id: true } } },
    });
    if (!user) throw new AppError("Only active patients may access the cart", HTTP_STATUS.FORBIDDEN);
    if (!user.patientProfile) throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
    return user.patientProfile.id;
};

const verifyPrescriptionForMedicine = async (
    patientId: string,
    medicineId: string,
    prescriptionId: string,
): Promise<boolean> => {
    const prescription = await prisma.prescription.findFirst({
        where: {
            id: prescriptionId,
            sentAt: { not: null },
            appointment: { patientId },
            items: { some: { medicineId } },
        },
        select: { id: true },
    });
    return Boolean(prescription);
};

const getPatientCart = async (userId: string): Promise<CartResponse> => {
    const patientId = await getActivePatientId(userId);

    const rows = await prisma.$queryRawUnsafe<RawCartItemRow[]>(`
        SELECT 
            ci.id,
            ci.patient_id,
            ci.medicine_id,
            ci.prescription_id,
            ci.quantity,
            ci.created_at,
            ci.updated_at,
            m.name,
            m.strength,
            m.requires_prescription,
            si.price,
            si.stock_quantity,
            si.is_available
        FROM cart_items ci
        JOIN medicines m ON m.id = ci.medicine_id
        JOIN store_inventory si ON si.medicine_id = m.id
        WHERE ci.patient_id = $1::uuid
        ORDER BY ci.created_at ASC
    `, patientId);

    let subtotal = 0;
    let allEligible = true;

    const items: CartItemResponse[] = [];

    for (const row of rows) {
        const unitPrice = Number(row.price);
        const lineTotal = unitPrice * row.quantity;
        subtotal += lineTotal;

        let prescriptionVerified = false;
        if (row.requires_prescription) {
            if (row.prescription_id) {
                prescriptionVerified = await verifyPrescriptionForMedicine(
                    patientId,
                    row.medicine_id,
                    row.prescription_id,
                );
            }
            if (!prescriptionVerified) {
                allEligible = false;
            }
        }

        if (!row.is_available || row.stock_quantity < row.quantity) {
            allEligible = false;
        }

        items.push({
            id: row.id,
            medicineId: row.medicine_id,
            name: row.name,
            strength: row.strength,
            quantity: row.quantity,
            unitPrice,
            lineTotal: Number(lineTotal.toFixed(2)),
            stockQuantity: row.stock_quantity,
            requiresPrescription: row.requires_prescription,
            prescriptionId: row.prescription_id,
            prescriptionVerified,
        });
    }

    const shipping = items.length > 0 ? 5.0 : 0.0;
    const total = Number((subtotal + shipping).toFixed(2));

    return {
        cartId: patientId,
        items,
        subtotal: Number(subtotal.toFixed(2)),
        shipping,
        total,
        eligibleForCheckout: items.length > 0 && allEligible,
    };
};

const addItemToCart = async (
    userId: string,
    input: { medicineId: string; quantity: number; prescriptionId?: string },
) => {
    const patientId = await getActivePatientId(userId);

    const medicine = await prisma.medicine.findFirst({
        where: {
            id: input.medicineId,
            isVerified: true,
            inventory: { is: { isAvailable: true } },
        },
        select: {
            id: true,
            name: true,
            requiresPrescription: true,
            inventory: { select: { id: true, price: true, stockQuantity: true } },
        },
    });

    if (!medicine || !medicine.inventory) {
        throw new AppError("Medicine is unavailable or not found", HTTP_STATUS.NOT_FOUND);
    }

    if (medicine.inventory.stockQuantity < input.quantity) {
        throw new AppError(`Insufficient stock for ${medicine.name}`, HTTP_STATUS.CONFLICT);
    }

    let prescriptionVerified = false;
    if (medicine.requiresPrescription) {
        if (!input.prescriptionId) {
            throw new AppError("This medication requires a valid finalized doctor prescription.", HTTP_STATUS.BAD_REQUEST);
        }
        prescriptionVerified = await verifyPrescriptionForMedicine(
            patientId,
            input.medicineId,
            input.prescriptionId,
        );
        if (!prescriptionVerified) {
            throw new AppError("The provided prescription is invalid or does not cover this medication.", HTTP_STATUS.BAD_REQUEST);
        }
    }

    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string; quantity: number }>>(`
        SELECT id, quantity FROM cart_items WHERE patient_id = $1::uuid AND medicine_id = $2::uuid LIMIT 1
    `, patientId, input.medicineId);

    let cartItemId: string;

    if (existingRows.length > 0) {
        const newQty = existingRows[0]!.quantity + input.quantity;
        if (medicine.inventory.stockQuantity < newQty) {
            throw new AppError(`Total quantity exceeds available stock (${medicine.inventory.stockQuantity})`, HTTP_STATUS.CONFLICT);
        }
        await prisma.$executeRawUnsafe(`
            UPDATE cart_items 
            SET quantity = $1, prescription_id = $2::uuid, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3::uuid
        `, newQty, input.prescriptionId ?? null, existingRows[0]!.id);
        cartItemId = existingRows[0]!.id;
    } else {
        const inserted = await prisma.$queryRawUnsafe<Array<{ id: string }>>(`
            INSERT INTO cart_items (patient_id, medicine_id, prescription_id, quantity)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
            RETURNING id
        `, patientId, input.medicineId, input.prescriptionId ?? null, input.quantity);
        cartItemId = inserted[0]!.id;
    }

    return {
        cartItemId,
        medicineId: input.medicineId,
        quantity: input.quantity,
        prescriptionVerified: medicine.requiresPrescription ? prescriptionVerified : true,
    };
};

const updateCartItemQuantity = async (
    userId: string,
    cartItemId: string,
    quantity: number,
) => {
    const patientId = await getActivePatientId(userId);

    const rows = await prisma.$queryRawUnsafe<RawCartItemRow[]>(`
        SELECT 
            ci.id,
            ci.patient_id,
            ci.medicine_id,
            ci.quantity,
            m.name,
            si.price,
            si.stock_quantity
        FROM cart_items ci
        JOIN medicines m ON m.id = ci.medicine_id
        JOIN store_inventory si ON si.medicine_id = m.id
        WHERE ci.id = $1::uuid AND ci.patient_id = $2::uuid
    `, cartItemId, patientId);

    if (rows.length === 0) {
        throw new AppError("Cart item not found or unauthorized", HTTP_STATUS.NOT_FOUND);
    }

    const item = rows[0]!;
    if (item.stock_quantity < quantity) {
        throw new AppError(`Requested quantity exceeds available stock (${item.stock_quantity})`, HTTP_STATUS.CONFLICT);
    }

    await prisma.$executeRawUnsafe(`
        UPDATE cart_items SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2::uuid
    `, quantity, cartItemId);

    const lineTotal = Number(item.price) * quantity;

    return {
        cartItemId,
        quantity,
        lineTotal: Number(lineTotal.toFixed(2)),
    };
};

const removeCartItem = async (userId: string, cartItemId: string) => {
    const patientId = await getActivePatientId(userId);

    const deletedCount = await prisma.$executeRawUnsafe(`
        DELETE FROM cart_items WHERE id = $1::uuid AND patient_id = $2::uuid
    `, cartItemId, patientId);

    if (deletedCount === 0) {
        throw new AppError("Cart item not found or unauthorized", HTTP_STATUS.NOT_FOUND);
    }

    return { message: "Item removed from cart." };
};

const clearCartForPatient = async (patientId: string, tx?: Prisma.TransactionClient) => {
    const db = tx ?? prisma;
    await db.$executeRawUnsafe(`
        DELETE FROM cart_items WHERE patient_id = $1::uuid
    `, patientId);
};

export const cartService = {
    getActivePatientId,
    verifyPrescriptionForMedicine,
    getPatientCart,
    addItemToCart,
    updateCartItemQuantity,
    removeCartItem,
    clearCartForPatient,
};

