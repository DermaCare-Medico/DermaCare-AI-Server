
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { CreateDoctorProfileInput, UpdateDoctorProfileInput } from "../../../types/doctors.types.js";



export const createDoctorProfile = async (
  userId: string,
  data: CreateDoctorProfileInput,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new AppError("User not found",404, );
  }

  if (user.role !== "DOCTOR") {
    throw new AppError("Only doctor accounts can create doctor profiles",403, );
  }

  const existingProfile = await prisma.doctorProfile.findUnique({
    where: { userId },
  });

  if (existingProfile) {
    throw new AppError("Doctor profile already exists",409, );
  }

  const specializationIds = [...new Set(data.specializationIds)];

  if (specializationIds.length === 0) {
    throw new AppError("At least one specialization is required",400, );
  }

  if (
    !Number.isFinite(data.consultationFee) ||
    data.consultationFee < 0
  ) {
    throw new AppError("Invalid consultation fee",400, );
  }

  if (
    data.experienceYears !== undefined &&
    (!Number.isInteger(data.experienceYears) || data.experienceYears < 0)
  ) {
    throw new AppError("Invalid experience years",400, );
  }

  const [licenseExists, specializations] = await Promise.all([
    prisma.doctorProfile.findUnique({
      where: { licenseNumber: data.licenseNumber },
      select: { id: true },
    }),
    prisma.specialization.findMany({
      where: { id: { in: specializationIds } },
      select: { id: true },
    }),
  ]);

  if (licenseExists) {
    throw new AppError("License number is already registered",409, );
  }

  if (specializations.length !== specializationIds.length) {
    throw new AppError("One or more specializations are invalid",400, );
  }

  return prisma.doctorProfile.create({
    data: {
      userId,
      licenseNumber: data.licenseNumber,
      qualifications: data.qualifications ?? [],
      experienceYears: data.experienceYears ?? 0,
      consultationFee: data.consultationFee,
      bio: data.bio,
      specializations: {
        create: specializationIds.map((specializationId) => ({
          specialization: {
            connect: { id: specializationId },
          },
        })),
      },
    },
    include: {
      specializations: {
        include: {
          specialization: true,
        },
      },
    },
  });
};

export const getMyDoctorProfile = async (userId: string) => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
    include: {
      specializations: {
        include: {
          specialization: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError("Doctor profile not found",404, );
  }

  return profile;
};

export const updateMyDoctorProfile = async (
  userId: string,
  data: UpdateDoctorProfileInput,
) => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true, approvalStatus: true },
  });

  if (!profile) {
    throw new AppError("Doctor profile not found",404, );
  }

  if (
    data.specializationIds !== undefined &&
    [...new Set(data.specializationIds)].length === 0
  ) {
    throw new AppError("At least one specialization is required",400, );
  }

  if (
    data.experienceYears !== undefined &&
    (!Number.isInteger(data.experienceYears) || data.experienceYears < 0)
  ) {
    throw new AppError("Invalid experience years",400, );
  }

  if (
    data.consultationFee !== undefined &&
    (!Number.isFinite(data.consultationFee) || data.consultationFee < 0)
  ) {
    throw new AppError("Invalid consultation fee",400 );
  }

  const specializationIds =
    data.specializationIds === undefined
      ? undefined
      : [...new Set(data.specializationIds)];

  if (specializationIds) {
    const specializations = await prisma.specialization.findMany({
      where: { id: { in: specializationIds } },
      select: { id: true },
    });

    if (specializations.length !== specializationIds.length) {
      throw new AppError("One or more specializations are invalid",400, );
    }
  }

  return prisma.$transaction(async (tx) => {
    if (specializationIds) {
      await tx.doctorSpecialization.deleteMany({
        where: { doctorId: profile.id },
      });

      await tx.doctorSpecialization.createMany({
        data: specializationIds.map((specializationId) => ({
          doctorId: profile.id,
          specializationId,
        })),
      });
    }

    return tx.doctorProfile.update({
      where: { id: profile.id },
      data: {
        ...(data.qualifications !== undefined && {
          qualifications: data.qualifications,
        }),
        ...(data.experienceYears !== undefined && {
          experienceYears: data.experienceYears,
        }),
        ...(data.consultationFee !== undefined && {
          consultationFee: data.consultationFee,
        }),
        ...(data.bio !== undefined && {
          bio: data.bio,
        }),
        // Profile edits must not automatically approve a doctor.
        ...(profile.approvalStatus === "APPROVED" &&
          specializationIds !== undefined && {
            approvalStatus: "PENDING",
            approvedById: null,
            approvedAt: null,
            rejectionReason: null,
          }),
      },
      include: {
        specializations: {
          include: {
            specialization: true,
          },
        },
      },
    });
  });
};
