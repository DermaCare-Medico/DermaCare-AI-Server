import { z } from "zod";

import { OrderStatus, PayoutStatus } from "../../generated/prisma/enums.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { uuidSchema } from "../../shared/validators/common.validator.js";

export type AdminPayoutListQuery = {
    page: number;
    limit: number;
    status?: PayoutStatus;
};

export type AdminOrderListQuery = {
    page: number;
    limit: number;
    status?: OrderStatus;
};

const paginationShape = {
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
};

const payoutListQuerySchema = z.object({
    ...paginationShape,
    status: z.enum(PayoutStatus).optional(),
}).strict();

const payoutIdParamsSchema = z.object({ id: uuidSchema }).strict();

const orderListQuerySchema = z.object({
    ...paginationShape,
    status: z.enum(OrderStatus).optional(),
}).strict();

export const validateAdminPayoutList = validateRequest({ query: payoutListQuerySchema });
export const validateAdminPayoutId = validateRequest({ params: payoutIdParamsSchema });
export const validateAdminOrderList = validateRequest({ query: orderListQuerySchema });
