import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../../shared/errors/AppError.js";

export async function getScreeningDoctorRecommendations(
  screeningId: string,
  userId: string,
) {
  const screening = await prisma.screening.findFirst({
    where: {
      id: screeningId,
      patient: {
        is: { userId },
      },
    },
    select: {
      id: true,
      aiStatus: true,
      predictions: {
        orderBy: { confidenceScore: "desc" },
        take: 1,
        select: {
          confidenceScore: true,
          condition: {
            select: {
              id: true,
              name: true,
              specializations: {
                select: {
                  specialization: {
                    select: {
                      id: true,
                      name: true,
                      doctors: {
                        where: {
                          doctor: {
                            is: {
                              approvalStatus: "APPROVED",
                            },
                          },
                        },
                        select: {
                          doctor: {
                            select: {
                              id: true,
                              qualifications: true,
                              experienceYears: true,
                              consultationFee: true,
                              bio: true,
                              rating: true,
                              ratingCount: true,
                              specializations: {
                                select: {
                                  specialization: {
                                    select: {
                                      id: true,
                                      name: true,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
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
    throw new AppError(
      "Screening not found or access denied",
      404,
    );
  }

  if (screening.aiStatus !== "COMPLETED") {
    throw new AppError(
      "Screening prediction is not completed",
      409,
    );
  }

  const prediction = screening.predictions[0];

  if (!prediction) {
    return {
      screeningId,
      condition: null,
      confidenceScore: null,
      specializations: [],
      doctors: [],
      message: "No prediction is available.",
    };
  }

  const condition = prediction.condition;

  // Do not recommend doctors for the model's normal/unknown label.
  if (condition.name === "Unknown Normal") {
    return {
      screeningId,
      condition: condition.name,
      confidenceScore: Number(prediction.confidenceScore),
      specializations: [],
      doctors: [],
      message:
        "No specific doctor recommendation is generated for this result.",
      disclaimer:
        "AI screening is not a medical diagnosis. Seek medical advice if you have persistent or concerning symptoms.",
    };
  }

  const specializations = condition.specializations.map(
    (item) => item.specialization,
  );

  const doctorMap = new Map<
    string,
    {
      id: string;
      qualifications: string[];
      experienceYears: number;
      consultationFee: unknown;
      bio: string | null;
      rating: unknown;
      ratingCount: number;
      specializations: { id: string; name: string }[];
    }
  >();

  for (const specialization of specializations) {
    for (const entry of specialization.doctors) {
      const doctor = entry.doctor;

      const existing = doctorMap.get(doctor.id);

      if (existing) continue;

      doctorMap.set(doctor.id, {
        id: doctor.id,
        qualifications: doctor.qualifications,
        experienceYears: doctor.experienceYears,
        consultationFee: doctor.consultationFee.toString(),
        bio: doctor.bio,
        rating: doctor.rating?.toString() ?? null,
        ratingCount: doctor.ratingCount,
        specializations: doctor.specializations.map(
          (item) => item.specialization,
        ),
      });
    }
  }

  const doctors = [...doctorMap.values()].sort(
    (a, b) =>
      b.experienceYears - a.experienceYears ||
      (Number(b.rating ?? 0) - Number(a.rating ?? 0)),
  );

  return {
    screeningId,
    condition: condition.name,
    confidenceScore: Number(prediction.confidenceScore),
    specializations: specializations.map(({ id, name }) => ({
      id,
      name,
    })),
    doctors,
    message:
      doctors.length > 0
        ? "Matching approved doctors found."
        : "No approved doctors are currently available for this condition.",
    disclaimer:
      "AI screening is not a medical diagnosis. Recommendations are based on configured specialization mappings. Consult a qualified clinician for medical assessment.",
  };
}