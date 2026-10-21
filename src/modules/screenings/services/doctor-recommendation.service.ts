import { DoctorApprovalStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";
import { HTTP_STATUS } from "../../../shared/constants/http-status.js";

export async function recommendDoctorsForScreening(
  userId: string,
  screeningId: string,
) {
  const patient = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!patient) {
    throw new AppError("Patient profile not found", HTTP_STATUS.NOT_FOUND);
  }

  const screening = await prisma.screening.findFirst({
    where: {
      id: screeningId,
      patientId: patient.id,
    },
    include: {
      predictions: {
        orderBy: { confidenceScore: "desc" },
        take: 1,
        include: {
          condition: {
            include: {
              specializations: {
                include: {
                  specialization: {
                    select: { id: true, name: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!screening) {
    throw new AppError("Screening not found", HTTP_STATUS.NOT_FOUND);
  }

  const prediction = screening.predictions[0];

  if (!prediction) {
    return {
      screeningId,
      condition: null,
      recommendations: [],
      message: "No prediction is available for this screening yet.",
    };
  }

  const conditionName = prediction.condition.name;
  const normalizedName = conditionName.trim().toLowerCase();

  // A normal result should not trigger a specialist recommendation.
  if (normalizedName === "normal" || normalizedName === "unknown normal") {
    return {
      screeningId,
      condition: {
        id: prediction.conditionId,
        name: conditionName,
        confidenceScore: prediction.confidenceScore,
      },
      recommendations: [],
      message: "No specific specialist recommendation is available.",
    };
  }

  const specializations = prediction.condition.specializations.map(
    (item) => item.specialization,
  );

  const specializationIds = specializations.map((item) => item.id);

  if (specializationIds.length === 0) {
    return {
      screeningId,
      condition: {
        id: prediction.conditionId,
        name: conditionName,
        confidenceScore: prediction.confidenceScore,
      },
      recommendations: [],
      message: "No matching specialization is configured for this condition.",
    };
  }

  const doctors = await prisma.doctorProfile.findMany({
    where: {
      approvalStatus: DoctorApprovalStatus.APPROVED,
      user: {
        role: "DOCTOR",
        status: "ACTIVE",
        deletedAt: null,
      },
      specializations: {
        some: {
          specializationId: { in: specializationIds },
        },
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
        where: {
          specializationId: { in: specializationIds },
        },
        select: {
          specialization: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: [
      { experienceYears: "desc" },
      { rating: "desc" },
    ],
  });

  return {
    screeningId,
    condition: {
      id: prediction.conditionId,
      name: conditionName,
      confidenceScore: prediction.confidenceScore,
    },
    matchedSpecializations: specializations,
    recommendations: doctors.map((doctor) => ({
      doctorId: doctor.id,
      name: doctor.user.name,
      qualifications: doctor.qualifications,
      experienceYears: doctor.experienceYears,
      consultationFee: doctor.consultationFee,
      rating: doctor.rating,
      ratingCount: doctor.ratingCount,
      bio: doctor.bio,
      specializations: doctor.specializations.map(
        (item) => item.specialization,
      ),
    })),
    disclaimer:
      "AI screening is not a medical diagnosis. Consult a qualified doctor for clinical assessment.",
  };
}