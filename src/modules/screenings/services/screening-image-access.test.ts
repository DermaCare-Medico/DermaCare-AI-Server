import assert from "node:assert/strict";
import test from "node:test";

import { getAuthorizedScreeningImageData } from "./screening-image.service.js";
import { getScreeningHistory, getScreeningHistoryItem } from "./screening-history.service.js";
import { prisma, closeDatabaseConnections } from "../../../lib/prisma.js";

test("getScreeningHistory attaches signed imageUrl and excludes storageKey", async () => {
  const mockDatabase = {
    screening: {
      findMany: async () => [
        {
          id: "screening-1",
          symptoms: "rash",
          bodyArea: "arm",
          imageQualityStatus: "GOOD",
          riskLevel: "LOW",
          redFlagDetected: false,
          aiStatus: "COMPLETED",
          disclaimer: null,
          createdAt: new Date(),
          completedAt: new Date(),
          predictions: [],
          images: [
            {
              id: "img-1",
              imageType: "FRONT",
              storageKey: "DermaCare-AI/screening-images/test_img",
              createdAt: new Date(),
            },
          ],
        },
      ],
    },
  } as never;

  const history = await getScreeningHistory("owner-id", mockDatabase);
  assert.equal(history.length, 1);
  assert.equal(history[0]?.images.length, 1);
  const img = history[0]?.images[0];
  assert.equal(img?.id, "img-1");
  assert.equal("storageKey" in (img ?? {}), false);
  assert.ok(typeof img?.imageUrl === "string");
  assert.ok(img?.imageUrl?.includes("https://api.cloudinary.com/v1_1/"));
  assert.ok(img?.imageUrl?.includes("signature="));
});

test("cross-patient access to screening image data is strictly rejected with 404", async () => {
  // Try querying as an attacker user id
  await assert.rejects(
    async () => {
      await getAuthorizedScreeningImageData(
        "99999999-9999-4999-8999-999999999999",
        "50000000-0000-4000-8000-000000000001",
        "51000000-0000-4000-8000-000000000001",
      );
    },
    (err: { statusCode?: number; message?: string }) => {
      return err.statusCode === 404 && err.message === "Screening image not found or access denied";
    },
  );
});

test("non-existent screening image returns 404", async () => {
  await assert.rejects(
    async () => {
      await getAuthorizedScreeningImageData(
        "20000000-0000-4000-8000-000000000002",
        "50000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000000",
      );
    },
    (err: { statusCode?: number; message?: string }) => {
      return err.statusCode === 404;
    },
  );
});

test("invalid non-uuid parameters reject safely with 404", async () => {
  await assert.rejects(
    async () => {
      await getAuthorizedScreeningImageData(
        "invalid-user-uuid",
        "invalid-screening-uuid",
        "invalid-image-uuid",
      );
    },
    (err: { statusCode?: number }) => {
      return err.statusCode === 404;
    },
  );

  await closeDatabaseConnections();
});
