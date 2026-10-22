
import {
  AccountStatus,
  DoctorApprovalStatus,
  Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { DoctorApplicationInput, DoctorProfileUpdateInput } from "../doctors.validation.js";

export const submitDoctorApplication = async (
  userId: string,
  input: DoctorApplicationInput,
) => {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    select: {
      id: true,
      role: true,
      doctorProfile: {
        select: {
          id: true,
          approvalStatus: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === Role.ADMIN || user.role === Role.STORE_OWNER) {
    throw new AppError("This account cannot apply as a doctor", 403);
  }

  if (
    user.doctorProfile?.approvalStatus === DoctorApprovalStatus.APPROVED
  ) {
    throw new AppError("Doctor application is already approved", 409);
  }

  const specializations = await prisma.specialization.findMany({
    where: {
      id: { in: input.specializationIds },
    },
    select: { id: true },
  });

  if (specializations.length !== input.specializationIds.length) {
    throw new AppError("One or more specializations are invalid", 400);
  }

  const profile = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { role: Role.USER },
    });
    const existing = await tx.doctorProfile.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (existing) {
      await tx.doctorSpecialization.deleteMany({
        where: { doctorId: existing.id },
      });

      return tx.doctorProfile.update({
        where: { userId },
        data: {
          licenseNumber: input.licenseNumber,
          qualifications: input.qualifications,
          experienceYears: input.experienceYears,
          consultationFee: input.consultationFee,
          bio: input.bio,
          approvalStatus: DoctorApprovalStatus.PENDING,
          approvedById: null,
          approvedAt: null,
          rejectionReason: null,
          specializations: {
            create: input.specializationIds.map((specializationId) => ({
              specialization: {
                connect: { id: specializationId },
              },
            })),
          },
        },
        include: {
          specializations: {
            include: { specialization: true },
          },
        },
      });
    }

    return tx.doctorProfile.create({
      data: {
        userId,
        licenseNumber: input.licenseNumber,
        qualifications: input.qualifications,
        experienceYears: input.experienceYears,
        consultationFee: input.consultationFee,
        bio: input.bio,
        approvalStatus: DoctorApprovalStatus.PENDING,
        specializations: {
          create: input.specializationIds.map((specializationId) => ({
            specialization: {
              connect: { id: specializationId },
            },
          })),
        },
      },
      include: {
        specializations: {
          include: { specialization: true },
        },
      },
    });
  });

  return {
    message: "Doctor application submitted for admin review",
    profile,
  };
};

export const getMyDoctorProfile = async (userId: string) => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: {
      specializations: {
        include: { specialization: true },
      },
    },
  });

  if (!profile) {
    throw new AppError("Doctor application not found", 404);
  }

  return profile;
};

export const updateMyDoctorProfile = async (
  userId: string,
  input: DoctorProfileUpdateInput,
) => {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      approvalStatus: true,
      user: { select: { role: true, status: true, deletedAt: true } },
    },
  });
  if (
    !doctor
    || doctor.approvalStatus !== DoctorApprovalStatus.APPROVED
    || doctor.user.role !== Role.DOCTOR
    || doctor.user.status !== AccountStatus.ACTIVE
    || doctor.user.deletedAt
  ) {
    throw new AppError("Approved active doctor account required", 403);
  }

  if (input.specializationIds) {
    const uniqueIds = [...new Set(input.specializationIds)];
    const count = await prisma.specialization.count({ where: { id: { in: uniqueIds } } });
    if (count !== uniqueIds.length) {
      throw new AppError("One or more specializations are invalid", 400);
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.specializationIds) {
      await tx.doctorSpecialization.deleteMany({ where: { doctorId: doctor.id } });
    }
    return tx.doctorProfile.update({
      where: { id: doctor.id },
      data: {
        qualifications: input.qualifications,
        experienceYears: input.experienceYears,
        consultationFee: input.consultationFee,
        bio: input.bio,
        ...(input.specializationIds && {
          specializations: {
            create: [...new Set(input.specializationIds)].map((specializationId) => ({
              specialization: { connect: { id: specializationId } },
            })),
          },
        }),
      },
      include: { specializations: { include: { specialization: true } } },
    });
  });
};
