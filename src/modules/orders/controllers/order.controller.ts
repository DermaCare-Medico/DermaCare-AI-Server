import type { Request, Response } from "express";

import { OrderStatus } from "../../../generated/prisma/enums.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { orderService } from "../services/order.service.js";

const listOrdersForAdmin = async (req: Request, res: Response) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);

    const result = await orderService.listOrdersForAdmin(userId, {
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        status: req.query.status as OrderStatus | undefined,
    });

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Orders retrieved successfully",
        data: result.orders,
        pagination: result.pagination,
    });
};

export const orderController = { listOrdersForAdmin };
