
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace?.(this, AppError);
  }
}

/*
## Example inside any service: 
import { AppError } from "../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../shared/constants/http-status.js";

throw new AppError(
  "Doctor not found",
  HTTP_STATUS.NOT_FOUND,
);
*/