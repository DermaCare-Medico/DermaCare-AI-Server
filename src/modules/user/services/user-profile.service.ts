import {
    AccountStatus,
    Prisma,
    Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { UpdateUserProfileInput } from "../user.validation.js";

const profileSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    emailVerified: true,
    createdAt: true,
    updatedAt: true,
} satisfies Prisma.UserSelect;

const requireActiveAdmin = async (userId: string) => {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            role: Role.ADMIN,
            status: AccountStatus.ACTIVE,
            deletedAt: null,
        },
        select: profileSelect,
    });

    if (!user) throw new AppError("Active administrator profile not found", 403);
    return user;
};

const getMyProfile = (userId: string) => requireActiveAdmin(userId);

const updateMyProfile = async (userId: string, input: UpdateUserProfileInput) => {
    await requireActiveAdmin(userId);

    try {
        return await prisma.user.update({
            where: { id: userId },
            data: {
                ...(input.name !== undefined && { name: input.name }),
                ...(input.phone !== undefined && { phone: input.phone }),
            },
            select: profileSelect,
        });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new AppError("Phone number is already in use", 409);
        }
        throw error;
    }
};

export const userProfileService = { getMyProfile, updateMyProfile };
