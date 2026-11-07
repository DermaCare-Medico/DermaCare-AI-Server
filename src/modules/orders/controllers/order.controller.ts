import type { Request, Response } from "express";

import { OrderStatus } from "../../../generated/prisma/enums.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { orderService } from "../services/order.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const createOrder = async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const order = await orderService.createOrder(userId, req.body, idempotencyKey);

    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: "Order placed successfully",
        data: order,
    });
};

const listMyOrders = async (req: Request, res: Response) => {
    const userId = getUserId(req);

    if (req.query.id && typeof req.query.id === "string") {
        const order = await orderService.getMyOrder(userId, req.query.id);
        return res.status(HTTP_STATUS.OK).json({
            success: true,
            statusCode: HTTP_STATUS.OK,
            message: "Order retrieved successfully",
            data: order,
        });
    }

    const result = await orderService.listMyOrders(userId, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
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

const getMyOrder = async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const order = await orderService.getMyOrder(userId, req.params.id!);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Order retrieved successfully",
        data: order,
    });
};

const listOrdersForAdmin = async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const result = await orderService.listOrdersForAdmin(userId, {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
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

const getOrderForAdmin = async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const order = await orderService.getOrderForAdmin(userId, req.params.id!);

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Order retrieved successfully",
        data: order,
    });
};

const updateOrderStatusForAdmin = async (req: Request, res: Response) => {
    const userId = getUserId(req);
    const order = await orderService.updateOrderStatusForAdmin(
        userId,
        req.params.id!,
        req.body,
    );

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Order status updated successfully",
        data: order,
    });
};

export const orderController = {
    createOrder,
    listMyOrders,
    getMyOrder,
    listOrdersForAdmin,
    getOrderForAdmin,
    updateOrderStatusForAdmin,
};
