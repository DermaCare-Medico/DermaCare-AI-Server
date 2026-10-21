export interface CreateDoctorProfileInput {
  specializationIds: string[];
  licenseNumber: string;
  qualifications?: string[];
  experienceYears?: number;
  consultationFee: number;
  bio?: string;
}

export interface UpdateDoctorProfileInput {
  specializationIds?: string[];
  qualifications?: string[];
  experienceYears?: number;
  consultationFee?: number;
  bio?: string;
}