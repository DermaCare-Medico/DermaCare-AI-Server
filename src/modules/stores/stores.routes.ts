import { Router } from "express";

import { asyncHandler } from "../../middlewares/asyncHandler.middleware.js";
import { medicineController } from "./controllers/medicine.controller.js";
import { cartController } from "./controllers/cart.controller.js";
import {
    validateAddToCart,
    validateCartItemId,
    validatePublicMedicineId,
    validatePublicMedicineList,
    validateUpdateCartItem,
} from "./stores.validation.js";

const storeRouter = Router();

// Public medicine catalog endpoints (mounted at /medicines in apiRouter)
storeRouter.get(
    "/",
    validatePublicMedicineList,
    asyncHandler(medicineController.listPublicMedicines),
);
storeRouter.get(
    "/:id",
    validatePublicMedicineId,
    asyncHandler(medicineController.getPublicMedicine),
);

export const cartRouter = Router();

// Authenticated patient shopping cart endpoints
cartRouter.get(
    "/cart",
    asyncHandler(cartController.getCart),
);
cartRouter.post(
    "/cart/items",
    validateAddToCart,
    asyncHandler(cartController.addToCart),
);
cartRouter.patch(
    "/cart/items/:id",
    validateUpdateCartItem,
    asyncHandler(cartController.updateCartItem),
);
cartRouter.delete(
    "/cart/items/:id",
    validateCartItemId,
    asyncHandler(cartController.removeCartItem),
);

export default storeRouter;
