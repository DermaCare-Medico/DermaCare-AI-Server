import assert from "node:assert/strict";
import test from "node:test";

import { getScreeningHistoryItem } from "./screening-history.service.js";
import { assertScreeningAcceptsImage } from "./screening-image.service.js";

test("screening detail reload is owner-scoped, returns alternatives, and hides storage keys", async () => {
  let query: Record<string, unknown> | undefined;
  const savedRecord = {
    id: "screening-id",
    bodyArea: "left forearm",
    predictions: [
      { confidenceScore: 78, condition: { name: "Acne" } },
      { confidenceScore: 12, condition: { name: "Eczema" } },
    ],
    images: [{ id: "image-id", imageType: "FRONT", storageKey: "DermaCare-AI/screening-images/test_img", createdAt: new Date() }],
  };
  const database = {
    screening: {
      findFirst: async (args: Record<string, unknown>) => {
        query = args;
        return savedRecord;
      },
    },
  } as never;

  const result = await getScreeningHistoryItem("owner-user-id", "screening-id", database);

  assert.equal(result?.id, savedRecord.id);
  assert.equal(result?.images[0]?.id, "image-id");
  assert.equal("storageKey" in (result?.images[0] ?? {}), false);
  assert.ok(typeof result?.images[0]?.imageUrl === "string");
  assert.deepEqual(query?.where, {
    id: "screening-id",
    patient: { is: { userId: "owner-user-id" } },
  });
  const select = query?.select as Record<string, unknown>;
  assert.equal(select.bodyArea, true);
  assert.equal(select.completedAt, true);
  assert.equal("take" in (select.predictions as Record<string, unknown>), false);
  assert.deepEqual(select.images, {
    select: { id: true, imageType: true, storageKey: true, createdAt: true },
  });
});

test("only pending or failed screenings are eligible for an atomic image-processing claim", () => {
  assert.doesNotThrow(() => assertScreeningAcceptsImage("PENDING"));
  assert.doesNotThrow(() => assertScreeningAcceptsImage("FAILED"));
  assert.throws(
    () => assertScreeningAcceptsImage("COMPLETED"),
    (error: { statusCode?: number }) => error.statusCode === 409,
  );
  assert.throws(
    () => assertScreeningAcceptsImage("PROCESSING"),
    (error: { statusCode?: number }) => error.statusCode === 409,
  );
});
