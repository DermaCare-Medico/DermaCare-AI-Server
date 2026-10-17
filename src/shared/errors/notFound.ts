
import type { RequestHandler } from "express";

import { AppError } from "./AppError.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export const notFound: RequestHandler = (
  req,
  _res,
  next,
) => {
  next(
    new AppError(
      `Route ${req.method} ${req.originalUrl} not found`,
      HTTP_STATUS.NOT_FOUND,
    ),
  );
};
