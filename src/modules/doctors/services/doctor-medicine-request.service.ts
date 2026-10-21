import {
  DoctorApprovalStatus,
  MedicineRequestStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

export async function createMedicineRequest(
  userId: string,
  input: {
    medicineName: string;
    genericName?: string;
    strength?: string;
    dosageForm?: string;
    manufacturer?: string;
    description?: string;
  },
) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      approvalStatus: true,
      user: { select: { status: true, deletedAt: true } },
    },
  });

  if (
    !doctor ||
    doctor.approvalStatus !== DoctorApprovalStatus.APPROVED ||
    doctor.user.status !== "ACTIVE" ||
    doctor.user.deletedAt
  ) {
    throw new AppError("Approved doctor required", HTTP_STATUS.FORBIDDEN);
  }

  return prisma.medicineRequest.create({
    data: {
      requestedById: doctor.id,
      medicineName: input.medicineName,
      genericName: input.genericName,
      strength: input.strength,
      dosageForm: input.dosageForm,
      manufacturer: input.manufacturer,
      description: input.description,
    },
  });
}

export async function getMyMedicineRequests(userId: string) {
  const doctor = await prisma.doctorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!doctor) {
    throw new AppError("Doctor profile not found", HTTP_STATUS.NOT_FOUND);
  }

  return prisma.medicineRequest.findMany({
    where: { requestedById: doctor.id },
    orderBy: { createdAt: "desc" },
  });
}