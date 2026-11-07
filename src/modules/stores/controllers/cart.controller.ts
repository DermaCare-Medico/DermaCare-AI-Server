import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../../shared/constants/http-status.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { cartService } from "../services/cart.service.js";

const getUserId = (req: Request) => {
    const userId = req.auth?.userId;
    if (!userId) throw new AppError("Unauthorized", HTTP_STATUS.UNAUTHORIZED);
    return userId;
};

const getCart = async (req: Request, res: Response) => {
    const cart = await cartService.getPatientCart(getUserId(req));
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Cart retrieved successfully",
        data: cart,
    });
};

const addToCart = async (req: Request, res: Response) => {
    const result = await cartService.addItemToCart(getUserId(req), req.body);
    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        statusCode: HTTP_STATUS.CREATED,
        message: result.prescriptionVerified
            ? "Item added to cart with verified prescription."
            : "Item added to cart.",
        data: result,
    });
};

const updateCartItem = async (req: Request, res: Response) => {
    const result = await cartService.updateCartItemQuantity(
        getUserId(req),
        req.params.id!,
        req.body.quantity,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: "Cart item quantity updated.",
        data: result,
    });
};

const removeCartItem = async (req: Request, res: Response) => {
    const result = await cartService.removeCartItem(
        getUserId(req),
        req.params.id!,
    );
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        statusCode: HTTP_STATUS.OK,
        message: result.message,
    });
};

export const cartController = {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
};

