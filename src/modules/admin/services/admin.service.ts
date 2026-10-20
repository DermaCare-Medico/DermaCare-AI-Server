import { AccountStatus, Role } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

export const requireActiveAdmin = async (userId: string) => {
    const admin = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: { id: true },
    });

    if (!admin) throw new AppError("Only active administrators may access this resource", 403);
};
