import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.js";
import { orderController } from "./controllers/order.controller.js";
import { validateCreateOrder } from "./orders.validation.js";

const orderRouter = Router();

orderRouter.post(
    "/orders",
    validateCreateOrder,
    asyncHandler(orderController.createOrder),
);

export default orderRouter;
