import assert from "node:assert/strict";
import test from "node:test";

import { authenticate } from "../middlewares/authenticate.middleware.js";

type MountLayer = {
  handle: unknown;
  regexp: RegExp;
};

test("screening router is mounted once before unscoped authenticated route chains", async () => {
  const [{ default: apiRouter }, { default: screeningRouter }] = await Promise.all([
    import("./index.js"),
    import("../modules/screenings/screenings.routes.js"),
  ]);
  const layers = (apiRouter as unknown as { stack: MountLayer[] }).stack;
  const mounts = layers.filter((layer) => layer.handle === screeningRouter);
  assert.equal(mounts.length, 1);
  assert.match(String(mounts[0]!.regexp), /screenings/);

  const screeningIndex = layers.indexOf(mounts[0]!);
  const unscopedAuthIndexes = layers
    .map((layer, index) => ({ layer, index }))
    .filter(({ layer }) => layer.handle === authenticate && String(layer.regexp).includes("^\\/?(?=\\/|$)"))
    .map(({ index }) => index);
  assert.ok(unscopedAuthIndexes.length >= 2);
  assert.ok(unscopedAuthIndexes.every((index) => screeningIndex < index));
});
