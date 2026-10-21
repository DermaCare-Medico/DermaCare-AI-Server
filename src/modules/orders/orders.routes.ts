import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { orderController } from "./controllers/order.controller.js";
import {
    validateCreateOrder,
    validatePatientOrderId,
    validatePatientOrderList,
} from "./orders.validation.js";

const orderRouter = Router();

orderRouter.post(
    "/orders",
    validateCreateOrder,
    asyncHandler(orderController.createOrder),
);
orderRouter.get(
    "/patients/me/orders",
    validatePatientOrderList,
    asyncHandler(orderController.listMyOrders),
);
orderRouter.get(
    "/patients/me/orders/:id",
    validatePatientOrderId,
    asyncHandler(orderController.getMyOrder),
);

export default orderRouter;
