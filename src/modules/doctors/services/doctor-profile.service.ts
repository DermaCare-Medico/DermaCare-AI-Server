
import {
  AccountStatus,
  DoctorApprovalStatus,
  Prisma,
  Role,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import type { DoctorApplicationInput, DoctorProfileUpdateInput } from "../doctors.validation.js";
import { downloadPrivateImage, uploadPrivateImage } from "../../../shared/services/cloudinary/cloudinary.service.js";

export const assertDoctorApplicationCanBeSubmitted = (
  approvalStatus: DoctorApprovalStatus | null,
) => {
  if (approvalStatus === DoctorApprovalStatus.APPROVED) {
    throw new AppError("Doctor application is already approved", 409);
  }
  if (approvalStatus === DoctorApprovalStatus.PENDING) {
    throw new AppError("Doctor application is already pending review", 409);
  }
};

export const assertDoctorApplicantRole = (role: Role) => {
  if (role !== Role.USER && role !== Role.PATIENT) {
    throw new AppError("This account cannot apply as a doctor", 403);
  }
};

export const doctorDocumentBelongsToUser = (reference: string, userId: string) => {
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `^DermaCare-AI/doctor-documents/${escapedUserId}/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$`,
  ).test(reference);
};

export const selectOwnedDoctorDocument = (
  references: string[],
  documentIndex: number,
  userId: string,
) => {
  const reference = references[documentIndex];
  if (!reference) throw new AppError("Doctor document not found", 404);
  if (!doctorDocumentBelongsToUser(reference, userId)) {
    throw new AppError("Doctor document access denied", 403);
  }
  return reference;
};

export const downloadMyDoctorDocument = async (userId: string, documentIndex: number) => {
  const profile = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { documentReferences: true },
  });
  if (!profile) throw new AppError("Doctor application not found", 404);
  return downloadPrivateImage(selectOwnedDoctorDocument(
    profile.documentReferences,
    documentIndex,
    userId,
  ));
};

export const storeDoctorApplicationDocument = async (userId: string, filePath: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, role: true },
  });
  if (!user) throw new AppError("Doctor document owner not found", 403);
  assertDoctorApplicantRole(user.role);
  const uploaded = await uploadPrivateImage(filePath, `DermaCare-AI/doctor-documents/${userId}`);
  return uploaded.public_id;
};

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

  if (user.doctorProfile?.approvalStatus === DoctorApprovalStatus.APPROVED) {
    assertDoctorApplicationCanBeSubmitted(user.doctorProfile.approvalStatus);
  }
  assertDoctorApplicantRole(user.role);
  if (input.documentReferences.some((reference) => !doctorDocumentBelongsToUser(reference, userId))) {
    throw new AppError("Doctor document does not belong to this account", 403);
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
    const existing = await tx.doctorProfile.findUnique({
      where: { userId },
      select: { id: true, approvalStatus: true },
    });

    if (existing) {
      assertDoctorApplicationCanBeSubmitted(existing.approvalStatus);

      const reset = await tx.doctorProfile.updateMany({
        where: {
          id: existing.id,
          approvalStatus: DoctorApprovalStatus.REJECTED,
        },
        data: {
          licenseNumber: input.licenseNumber,
          qualifications: input.qualifications,
          experienceYears: input.experienceYears,
          consultationFee: input.consultationFee,
          bio: input.bio,
          documentReferences: input.documentReferences,
          approvalStatus: DoctorApprovalStatus.PENDING,
          approvedById: null,
          approvedAt: null,
          rejectionReason: null,
        },
      });
      if (reset.count !== 1) {
        throw new AppError("Doctor application changed while being submitted", 409);
      }

      await tx.doctorSpecialization.deleteMany({
        where: { doctorId: existing.id },
      });
      await tx.doctorSpecialization.createMany({
        data: input.specializationIds.map((specializationId) => ({
          doctorId: existing.id,
          specializationId,
        })),
      });
      await tx.user.update({
        where: { id: userId },
        data: { role: Role.USER },
      });

      return tx.doctorProfile.findUniqueOrThrow({
        where: { id: existing.id },
        include: {
          specializations: {
            include: { specialization: true },
          },
        },
      });
    }

    const created = await tx.doctorProfile.create({
      data: {
        userId,
        licenseNumber: input.licenseNumber,
        qualifications: input.qualifications,
        experienceYears: input.experienceYears,
        consultationFee: input.consultationFee,
        bio: input.bio,
        documentReferences: input.documentReferences,
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
    await tx.user.update({
      where: { id: userId },
      data: { role: Role.USER },
    });
    return created;
  }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("A doctor application or license number already exists", 409);
    }
    throw error;
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
