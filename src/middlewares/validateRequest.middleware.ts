
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

interface RequestSchemas {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: {
      location: string;
      issues: {
        path: string;
        message: string;
      }[];
    }[] = [];

    for (const location of ["body", "params", "query"] as const) {
      const schema = schemas[location];

      if (!schema) continue;

      const result = schema.safeParse(req[location]);

      if (!result.success) {
        errors.push({
          location,
          issues: result.error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            message: issue.message,
          })),
        });

        continue;
      }

      if (location === "body") req.body = result.data;
      if (location === "params") {
        Object.assign(req.params, result.data);
      }
      if (location === "query") {
        Object.assign(req.query, result.data);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Request validation failed",
        errors,
      });
    }

    next();
  };
}

/* 
## Example usage in a route: 

router.get(
  "/",
  validateRequest({ query: paginationQuerySchema }),
  conditionController.getAll,
);

*/