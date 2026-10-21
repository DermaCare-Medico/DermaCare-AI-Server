
import { v2 as cloudinary } from "cloudinary";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import { AppError } from "../../errors/AppError.js";


let configured = false;

export function ensureCloudinaryConfigured(): void {
  if (configured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError("Image storage is not configured", 503);
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

export { cloudinary };


export async function uploadPrivateImage(
  filePath: string,
  folder = "DermaCare-AI/screening-images",
): Promise<UploadApiResponse> {
  ensureCloudinaryConfigured();
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image",
    type: "authenticated",
    overwrite: false,
  } satisfies UploadApiOptions);

  return result;
}


export async function deletePrivateImage(
  publicId: string,
): Promise<void> {
  ensureCloudinaryConfigured();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    type: "authenticated",
    invalidate: true,
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error(
      `Failed to delete Cloudinary image: ${result.result}`,
    );
  }
}
