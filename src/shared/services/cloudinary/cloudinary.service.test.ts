import assert from "node:assert/strict";
import test from "node:test";

test("Cloudinary module loads without credentials and fails lazily", async () => {
  const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  try {
    const { ensureCloudinaryConfigured } = await import("./cloudinary.service.js");
    assert.throws(
      () => ensureCloudinaryConfigured(),
      (error: { statusCode?: number; message?: string }) =>
        error.statusCode === 503 && error.message === "Image storage is not configured",
    );
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
