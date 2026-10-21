
import {
  AccountStatus,
  DoctorApprovalStatus,
  Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { RejectDoctorApplicationInput } from "../doctors.validation.js";

export const getPendingDoctorApplications = async (
  page = 1,
  limit = 10,
) => {
  const where = {
    approvalStatus: DoctorApprovalStatus.PENDING,
    user: {
      deletedAt: null,
    },
  };

  const [applications, total] = await prisma.$transaction([
    prisma.doctorProfile.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        },
        specializations: {
          include: { specialization: true },
        },
      },
    }),
    prisma.doctorProfile.count({ where }),
  ]);

  return {
    data: applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const approveDoctorApplication = async (
  adminId: string,
  applicationId: string,
) => {
  return prisma.$transaction(async (tx) => {
    const application = await tx.doctorProfile.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        approvalStatus: true,
        user: {
          select: {
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (!application) {
      throw new AppError("Doctor application not found", 404);
    }

    if (application.approvalStatus !== DoctorApprovalStatus.PENDING) {
      throw new AppError("Application has already been reviewed", 409);
    }

    if (
      application.user.deletedAt ||
      application.user.status !== AccountStatus.ACTIVE
    ) {
      throw new AppError("Applicant account is not active", 403);
    }

    await tx.doctorProfile.update({
      where: { id: applicationId },
      data: {
        approvalStatus: DoctorApprovalStatus.APPROVED,
        approvedById: adminId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: { role: Role.DOCTOR },
    });

    return { message: "Doctor application approved successfully" };
  });
};

export const rejectDoctorApplication = async (
  applicationId: string,
  input: RejectDoctorApplicationInput,
) => {
  return prisma.$transaction(async (tx) => {
    const application = await tx.doctorProfile.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        userId: true,
        approvalStatus: true,
      },
    });

    if (!application) {
      throw new AppError("Doctor application not found", 404);
    }

    if (application.approvalStatus !== DoctorApprovalStatus.PENDING) {
      throw new AppError("Application has already been reviewed", 409);
    }

    await tx.doctorProfile.update({
      where: { id: applicationId },
      data: {
        approvalStatus: DoctorApprovalStatus.REJECTED,
        approvedById: null,
        approvedAt: null,
        rejectionReason: input.reason,
      },
    });

    await tx.user.update({
      where: { id: application.userId },
      data: { role: Role.USER },
    });

    return { message: "Doctor application rejected" };
  });
};
