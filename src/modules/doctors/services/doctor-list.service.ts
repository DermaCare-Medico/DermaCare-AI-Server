
import {
  AccountStatus,
  DoctorApprovalStatus,
  Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { presentDoctorSpecializations } from "../doctor-specializations.presenter.js";

export const getApprovedDoctors = async (query: {
  page: number;
  limit: number;
  specializationId?: string;
}) => {
  const { page, limit, specializationId } = query;

  const where = {
    approvalStatus: DoctorApprovalStatus.APPROVED,
    user: {
      role: Role.DOCTOR,
      status: AccountStatus.ACTIVE,
      deletedAt: null,
    },
    ...(specializationId
      ? {
          specializations: {
            some: { specializationId },
          },
        }
      : {}),
  };

  const [doctors, total] = await prisma.$transaction([
    prisma.doctorProfile.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        qualifications: true,
        experienceYears: true,
        consultationFee: true,
        bio: true,
        rating: true,
        ratingCount: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        specializations: {
          include: {
            specialization: true,
          },
        },
      },
    }),
    prisma.doctorProfile.count({ where }),
  ]);

  const formattedDoctors = doctors.map((doc) => {
    const { specializations: rawSpecs, ...rest } = doc;
    return {
      ...rest,
      ...presentDoctorSpecializations(rawSpecs),
    };
  });

  return {
    data: formattedDoctors,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getApprovedDoctorById = async (doctorId: string) => {
  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      id: doctorId,
      approvalStatus: DoctorApprovalStatus.APPROVED,
      user: {
        role: Role.DOCTOR,
        status: AccountStatus.ACTIVE,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      qualifications: true,
      experienceYears: true,
      consultationFee: true,
      bio: true,
      rating: true,
      ratingCount: true,
      user: {
        select: {
          id: true,
          name: true,
        },
      },
      specializations: {
        include: { specialization: true },
      },
    },
  });

  if (!doctor) {
    throw new AppError("Doctor not found", 404);
  }

  const { specializations: rawSpecs, ...rest } = doctor;
  return {
    ...rest,
    ...presentDoctorSpecializations(rawSpecs),
  };
};
