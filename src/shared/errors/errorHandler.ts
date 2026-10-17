
import type {
  ErrorRequestHandler,
} from "express";

import { AppError } from "./AppError.js";
import { HTTP_STATUS } from "../constants/http-status.js";

export const errorHandler: ErrorRequestHandler = (
  err,
  req,
  res,
  _next,
) => {
  if (res.headersSent) {
    return;
  }

  const isAppError = err instanceof AppError;

  const statusCode = isAppError
    ? err.statusCode
    : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const message = isAppError
    ? err.message
    : "Internal server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    statusCode,
    success: false,
    message,
    data: null,
  });
};

/*
## predictable error responses:
{
  "statusCode": 404,
  "success": false,
  "message": "Doctor not found",
  "data": null
}
*/