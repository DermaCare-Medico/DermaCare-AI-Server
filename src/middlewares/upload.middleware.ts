
import multer from "multer";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
]);

export const uploadScreeningImage = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();

      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
    fields: 2,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error("Only JPG and PNG images are allowed"),
      );
    }

    callback(null, true);
  },
}).single("image");
