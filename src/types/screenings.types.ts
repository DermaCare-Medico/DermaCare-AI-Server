import { ImageType } from "../generated/prisma/enums.js";

export interface SaveScreeningImageInput {
  screeningId: string;
  filePath: string;
  imageType: ImageType; 
}