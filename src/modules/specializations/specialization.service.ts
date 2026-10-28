import { prisma } from "../../lib/prisma.js";

export const listSpecializations = () =>
  prisma.specialization.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
