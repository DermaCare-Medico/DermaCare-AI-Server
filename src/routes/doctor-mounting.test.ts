import assert from "node:assert/strict";
import test from "node:test";

type MountLayer = {
  handle: unknown;
  regexp: RegExp;
};

test("Doctor router is mounted exactly once at /doctors", async () => {
  process.env.CLOUDINARY_CLOUD_NAME ||= "route-test";
  process.env.CLOUDINARY_API_KEY ||= "route-test";
  process.env.CLOUDINARY_API_SECRET ||= "route-test";

  const [{ default: apiRouter }, { default: doctorRouter }] = await Promise.all([
    import("./index.js"),
    import("../modules/doctors/doctors.routes.js"),
  ]);
  const layers = (apiRouter as unknown as { stack: MountLayer[] }).stack;
  const doctorMounts = layers.filter((layer) => layer.handle === doctorRouter);

  assert.equal(doctorMounts.length, 1);
  assert.match(String(doctorMounts[0]!.regexp), /\\\/doctors/);
  assert.doesNotMatch(String(doctorMounts[0]!.regexp), /api\\\/doctors/);
});
