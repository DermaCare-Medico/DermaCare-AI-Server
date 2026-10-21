
import multer from "multer";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
];

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => {
      callback(null, `${randomUUID()}${path.extname(_file.originalname).toLowerCase()}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPG, JPEG, and PNG images are allowed"),
      );
    }

    callback(null, true);
  },
});

export const uploadScreeningImage = upload.single("image");
