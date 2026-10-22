import assert from "node:assert/strict";
import test from "node:test";
import routes from "./prescriptions.routes.js";

test("mounts Doctor prescription lifecycle and Patient privacy routes", () => {
  const mounted = (routes as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack
    .filter((layer) => layer.route)
    .map((layer) => `${Object.keys(layer.route!.methods)[0]!.toUpperCase()} ${layer.route!.path}`);
  assert.deepEqual(mounted, [
    "POST /appointments/:id/prescriptions",
    "PATCH /prescriptions/:id",
    "PUT /prescriptions/:id/items",
    "POST /prescriptions/:id/finalize",
    "POST /prescriptions/:id/send",
    "GET /patients/me/prescriptions",
    "GET /patients/me/prescriptions/:id",
    "GET /doctors/me/prescriptions",
    "GET /prescriptions",
  ]);
});
