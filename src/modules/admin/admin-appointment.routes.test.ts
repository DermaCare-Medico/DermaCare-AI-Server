import assert from "node:assert/strict";
import test from "node:test";

import adminRouter from "./admin.routes.js";

const routes = (adminRouter as any).stack
  .filter((layer: any) => layer.route)
  .flatMap((layer: any) => Object.keys(layer.route.methods).map((method) => ({
    method: method.toUpperCase(),
    path: layer.route.path,
  })));

test("Admin router exposes appointment cancellation review, direct cancellation and no-show actions", () => {
  for (const expected of [
    { method: "PATCH", path: "/appointments/:id/cancellation" },
    { method: "POST", path: "/appointments/:id/cancel" },
    { method: "PATCH", path: "/appointments/:id/no-show" },
  ]) {
    assert.ok(routes.some((route: any) => route.method === expected.method && route.path === expected.path));
  }
});
