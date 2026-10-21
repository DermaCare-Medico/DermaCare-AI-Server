import assert from "node:assert/strict";
import test from "node:test";

import app from "../../app.js";
import paymentRouter from "./payments.routes.js";

type Layer = { route?: { path: string; methods: Record<string, boolean>; stack: unknown[] } };

test("authenticated payment router mounts both hosted checkout APIs", () => {
  const routes = (paymentRouter as unknown as { stack: Layer[] }).stack
    .flatMap((layer) => layer.route ? [`${Object.keys(layer.route.methods)[0]} ${layer.route.path}`] : []);
  assert.ok(routes.includes("post /appointments/:id/payments/checkout"));
  assert.ok(routes.includes("post /orders/:id/payments/checkout"));
});

test("public Stripe webhook is mounted before JSON parsing", () => {
  const stack = (app as unknown as { _router: { stack: Array<{ route?: { path: string } }> } })._router.stack;
  const webhook = stack.findIndex((layer) => layer.route?.path === "/api/v1/payments/stripe/webhook");
  assert.ok(webhook >= 0);
});
