import assert from "node:assert/strict";
import test from "node:test";

import screeningRoutes from "./screenings.routes.js";
import { createScreeningSchema, screeningImageSchema } from "./screenings.validation.js";

test("screening questionnaire requires non-empty symptoms", () => {
  assert.equal(createScreeningSchema.safeParse({}).success, false);
  assert.equal(createScreeningSchema.safeParse({ symptoms: "   " }).success, false);
  assert.deepEqual(createScreeningSchema.parse({ symptoms: "  itchy rash  " }), {
    symptoms: "itchy rash",
  });
});

test("screening questionnaire preserves a normalized body area", () => {
  assert.deepEqual(
    createScreeningSchema.parse({ symptoms: "rash", bodyArea: "  left forearm  " }),
    { symptoms: "rash", bodyArea: "left forearm" },
  );
});

test("image upload requires a created screening ID and image type", () => {
  assert.equal(screeningImageSchema.safeParse({ screeningId: "invalid", imageType: "FRONT" }).success, false);
  assert.equal(screeningImageSchema.safeParse({ screeningId: "123e4567-e89b-42d3-a456-426614174000", imageType: "FRONT" }).success, true);
});

test("Screening router mounts creation before image, history, and recommendation APIs", () => {
  const mounted = (screeningRoutes as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route!.methods)[0]!.toUpperCase()} ${layer.route!.path}`);
  assert.deepEqual(mounted, [
    "POST /",
    "POST /images",
    "GET /history",
    "GET /history/:screeningId",
    "GET /history/:screeningId/images/:imageId",
    "POST /:screeningId/retry",
    "GET /:screeningId/doctors",
  ]);
});
