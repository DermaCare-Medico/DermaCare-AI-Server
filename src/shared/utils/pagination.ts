
import type { PaginationMeta } from "../../types/api.js";

interface PaginationOptions {
  page?: number;
  limit?: number;
}

export function getPagination({
  page = 1,
  limit = 10,
}: PaginationOptions = {}) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 100)
      : 10;

  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}

export function getPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/* 
Example with Prisma:
const { page, limit, skip, take } = getPagination({
  page: Number(req.query.page),
  limit: Number(req.query.limit),
});

const [data, total] = await Promise.all([
  prisma.condition.findMany({ skip, take }),
  prisma.condition.count(),
]);

const meta = getPaginationMeta(total, page, limit);

*/