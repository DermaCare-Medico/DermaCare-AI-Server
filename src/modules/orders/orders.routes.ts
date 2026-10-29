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

// Standard /patients/me/orders
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

// Standard /orders list or ?id= detail endpoint
orderRouter.get(
    "/orders",
    validatePatientOrderList,
    asyncHandler(orderController.listMyOrders),
);
orderRouter.get(
    "/orders/:id",
    validatePatientOrderId,
    asyncHandler(orderController.getMyOrder),
);

export default orderRouter;
