import assert from "node:assert/strict";
import test from "node:test";
import { authenticate } from "../middlewares/authenticate.middleware.js";

type Layer = {
  handle: unknown;
  regexp: RegExp;
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ name: string }>;
  };
};

test("GET /specializations is public and is the module's only endpoint", async () => {
  const { default: specializationRouter } = await import(
    "../modules/specializations/specializations.routes.js"
  );
  const layers = (specializationRouter as unknown as { stack: Layer[] }).stack;
  const routes = layers.filter((layer) => layer.route);

  assert.equal(routes.length, 1);
  assert.equal(routes[0]!.route!.path, "/");
  assert.equal(routes[0]!.route!.methods.get, true);
  assert.equal(routes[0]!.route!.stack.length, 1);
  assert.equal(
    routes[0]!.route!.stack.some((layer) => layer.name === "authenticate"),
    false,
  );
});

test("public specialization mount precedes protected route chains", async () => {
  const [{ default: apiRouter }, { default: specializationRouter }] = await Promise.all([
    import("./index.js"),
    import("../modules/specializations/specializations.routes.js"),
  ]);
  const layers = (apiRouter as unknown as { stack: Layer[] }).stack;
  const mountIndex = layers.findIndex((layer) => layer.handle === specializationRouter);
  const protectedChainIndex = layers.findIndex((layer) => layer.handle === authenticate);

  assert.ok(mountIndex >= 0);
  assert.match(String(layers[mountIndex]!.regexp), /\\\/specializations/);
  assert.ok(protectedChainIndex >= 0);
  assert.ok(mountIndex < protectedChainIndex);
  assert.ok(
    layers.some((layer, index) => index > mountIndex && layer.handle === authenticate),
    "protected routes must retain authentication after the public specialization mount",
  );
});
