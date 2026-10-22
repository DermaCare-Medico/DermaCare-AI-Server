export interface DoctorSpecializationSummary {
  id: string;
  name: string;
}

interface DoctorSpecializationLink {
  specialization: DoctorSpecializationSummary;
}

export const presentDoctorSpecializations = (
  links: DoctorSpecializationLink[],
) => {
  const specializations = links.map(({ specialization }) => specialization);

  return {
    // Retained for older clients; new clients should consume the full array.
    specialization: specializations[0] ?? null,
    specializations,
  };
};
