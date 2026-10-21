import {
  AccountStatus,
  AppointmentStatus,
  DoctorApprovalStatus,
  NotificationType,
  Prisma,
  Role,
} from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../shared/errors/AppError.js";
import { createNotification } from "../notifications/services/notification.service.js";
import { canCreatePrescription, isPrescriptionMutable } from "./prescription.rules.js";
import type { PrescriptionItemInput } from "./prescriptions.validation.js";

const prescriptionSelect = {
  id: true,
  appointmentId: true,
  doctorId: true,
  findings: true,
  advice: true,
  followUp: true,
  createdAt: true,
  sentAt: true,
  doctor: { select: { user: { select: { name: true } } } },
  appointment: { select: { patient: { select: { user: { select: { name: true } } } } } },
  items: { orderBy: { id: "asc" as const } },
} satisfies Prisma.PrescriptionSelect;

async function getDoctor(userId: string) {
  const doctor = await prisma.doctorProfile.findFirst({
    where: {
      userId,
      approvalStatus: DoctorApprovalStatus.APPROVED,
      user: { role: Role.DOCTOR, status: AccountStatus.ACTIVE, deletedAt: null },
    },
    select: { id: true },
  });
  if (!doctor) throw new AppError("Approved doctor required", 403);
  return doctor;
}

const itemData = (item: PrescriptionItemInput) => ({
  medicineId: item.medicineId,
  medicineName: item.medicineName,
  dosage: item.dosage,
  frequency: item.frequency,
  duration: item.duration,
  instructions: item.instructions,
});

export async function createPrescription(
  userId: string,
  appointmentId: string,
  input: {
    findings?: string; diagnosis?: string; advice?: string; doctorNotes?: string;
    followUp?: string; items: PrescriptionItemInput[];
  },
) {
  const doctor = await getDoctor(userId);
  return prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findFirst({
      where: { id: appointmentId, doctorId: doctor.id },
      select: { id: true, status: true, prescription: { select: { id: true } } },
    });
    if (!appointment) throw new AppError("Appointment not found", 404);
    if (!canCreatePrescription(appointment.status)) {
      throw new AppError("Prescription requires a completed consultation", 409);
    }
    if (appointment.prescription) {
      return tx.prescription.findUniqueOrThrow({
        where: { id: appointment.prescription.id }, select: prescriptionSelect,
      });
    }
    return tx.prescription.create({
      data: {
        appointmentId,
        doctorId: doctor.id,
        findings: input.findings ?? input.diagnosis,
        advice: input.advice ?? input.doctorNotes,
        followUp: input.followUp,
        items: { create: input.items.map(itemData) },
      },
      select: prescriptionSelect,
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function requireOwnedDraft(userId: string, prescriptionId: string) {
  const doctor = await getDoctor(userId);
  const prescription = await prisma.prescription.findFirst({
    where: { id: prescriptionId, doctorId: doctor.id },
    select: { id: true, sentAt: true },
  });
  if (!prescription) throw new AppError("Prescription not found", 404);
  if (!isPrescriptionMutable(prescription.sentAt)) {
    throw new AppError("Sent prescriptions cannot be modified", 409);
  }
  return { doctor, prescription };
}

export async function updatePrescription(userId: string, prescriptionId: string, input: {
  findings?: string | null; diagnosis?: string | null; advice?: string | null;
  doctorNotes?: string | null; followUp?: string | null;
}) {
  const { doctor } = await requireOwnedDraft(userId, prescriptionId);
  const updated = await prisma.prescription.updateMany({
    where: { id: prescriptionId, doctorId: doctor.id, sentAt: null },
    data: {
      ...(input.findings !== undefined || input.diagnosis !== undefined
        ? { findings: input.findings ?? input.diagnosis ?? null } : {}),
      ...(input.advice !== undefined || input.doctorNotes !== undefined
        ? { advice: input.advice ?? input.doctorNotes ?? null } : {}),
      ...(input.followUp !== undefined ? { followUp: input.followUp } : {}),
    },
  });
  if (updated.count !== 1) throw new AppError("Sent prescriptions cannot be modified", 409);
  return prisma.prescription.findUniqueOrThrow({
    where: { id: prescriptionId }, select: prescriptionSelect,
  });
}

export async function replacePrescriptionItems(
  userId: string, prescriptionId: string, items: PrescriptionItemInput[],
) {
  const { doctor } = await requireOwnedDraft(userId, prescriptionId);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.prescription.findFirst({
      where: { id: prescriptionId, doctorId: doctor.id, sentAt: null }, select: { id: true },
    });
    if (!claimed) throw new AppError("Sent prescriptions cannot be modified", 409);
    await tx.prescriptionItem.deleteMany({ where: { prescriptionId } });
    await tx.prescriptionItem.createMany({
      data: items.map((item) => ({ prescriptionId, ...itemData(item) })),
    });
    return tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, select: prescriptionSelect });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function sendPrescription(userId: string, prescriptionId: string) {
  const doctor = await getDoctor(userId);
  return prisma.$transaction(async (tx) => {
    const prescription = await tx.prescription.findFirst({
      where: { id: prescriptionId, doctorId: doctor.id },
      select: {
        id: true, sentAt: true,
        _count: { select: { items: true } },
        appointment: { select: { status: true, patient: { select: { userId: true } } } },
      },
    });
    if (!prescription) throw new AppError("Prescription not found", 404);
    if (prescription.sentAt) {
      return tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, select: prescriptionSelect });
    }
    if (prescription.appointment.status !== AppointmentStatus.COMPLETED) {
      throw new AppError("Prescription requires a completed consultation", 409);
    }
    if (prescription._count.items === 0) throw new AppError("Cannot send an empty prescription", 400);

    const sentAt = new Date();
    const sent = await tx.prescription.updateMany({
      where: { id: prescriptionId, doctorId: doctor.id, sentAt: null },
      data: { sentAt },
    });
    if (sent.count !== 1) {
      return tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, select: prescriptionSelect });
    }
    await createNotification({
      userId: prescription.appointment.patient.userId,
      title: "New prescription available",
      message: "Your doctor has sent a prescription after your consultation.",
      notificationType: NotificationType.PRESCRIPTION,
      relatedEntityType: "Prescription",
      relatedEntityId: prescriptionId,
    }, tx);
    return tx.prescription.findUniqueOrThrow({ where: { id: prescriptionId }, select: prescriptionSelect });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function getPatient(userId: string) {
  const patient = await prisma.patientProfile.findFirst({
    where: { userId, user: { role: Role.PATIENT, status: AccountStatus.ACTIVE, deletedAt: null } },
    select: { id: true },
  });
  if (!patient) throw new AppError("Active patient required", 403);
  return patient;
}

export async function listPatientPrescriptions(userId: string, page: number, limit: number) {
  const patient = await getPatient(userId);
  const where: Prisma.PrescriptionWhereInput = {
    sentAt: { not: null }, appointment: { patientId: patient.id },
  };
  const [prescriptions, total] = await prisma.$transaction([
    prisma.prescription.findMany({
      where, orderBy: { sentAt: "desc" }, skip: (page - 1) * limit, take: limit,
      select: prescriptionSelect,
    }),
    prisma.prescription.count({ where }),
  ]);
  return { prescriptions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getPatientPrescription(userId: string, prescriptionId: string) {
  const patient = await getPatient(userId);
  const prescription = await prisma.prescription.findFirst({
    where: { id: prescriptionId, sentAt: { not: null }, appointment: { patientId: patient.id } },
    select: prescriptionSelect,
  });
  if (!prescription) throw new AppError("Prescription not found", 404);
  return prescription;
}
